// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title GovernedTreasury
/// @author Jerónimo Núñez
/// @notice Tesorería de tokens ERC-20 con controles internos de estilo bancario:
///         segregación de funciones, doble firma para montos altos, tope para
///         retiros sin doble firma, límites de velocidad, beneficiarios agendados,
///         vencimiento de órdenes y pausa de emergencia.
/// @dev El DEFAULT_ADMIN_ROLE lo tiene un TimelockController: todo cambio que
///      amplíe permisos espera el delay del timelock. Restringir es rápido
///      (guardián); ampliar es lento (timelock). Las funciones que mueven fondos
///      siguen Checks-Effects-Interactions y además usan nonReentrant.
contract GovernedTreasury is AccessControl, Pausable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Tipos
    // ------------------------------------------------------------------

    /// @notice Límites de operación vigentes.
    /// @dev Cuatro uint96 en 2 slots: [perTxLimit + dailyLimit] y
    ///      [approvalThreshold + directDailyLimit].
    ///      Invariantes: 0 < approvalThreshold <= perTxLimit <= dailyLimit
    ///      y 0 < directDailyLimit <= dailyLimit.
    struct Limits {
        uint96 perTxLimit; // Máximo por operación
        uint96 dailyLimit; // Máximo acumulado por día (todos los retiros)
        uint96 approvalThreshold; // Desde este monto se exige doble firma
        uint96 directDailyLimit; // Máximo diario de retiros sin doble firma
    }

    /// @notice Gasto acumulado de un día.
    /// @dev Dos uint128 en 1 slot: se leen y escriben juntos.
    struct DailySpend {
        uint128 total; // Todo lo retirado en el día
        uint128 direct; // Solo lo retirado sin doble firma
    }

    /// @notice Estados posibles de una solicitud de retiro.
    enum Status {
        None,
        Pending,
        Executed,
        Rejected
    }

    /// @notice Solicitud de retiro que requiere doble firma.
    /// @dev Ocupa 2 slots: [to (20 bytes) + amount (12 bytes)] y
    ///      [requester (20 bytes) + status (1 byte) + expiresAt (5 bytes)].
    struct WithdrawalRequest {
        address to; // Beneficiario
        uint96 amount; // Monto solicitado
        address requester; // Operador que la creó
        Status status; // Estado
        uint40 expiresAt; // Momento a partir del cual ya no se puede aprobar
    }

    // ------------------------------------------------------------------
    // Variables de estado
    // ------------------------------------------------------------------

    /// @notice Rol que ejecuta retiros chicos y pide los grandes.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Rol que aprueba o rechaza retiros grandes.
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    /// @notice Rol que pausa la tesorería y revoca beneficiarios.
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @notice Vigencia de una solicitud de retiro.
    uint256 public constant REQUEST_TTL = 3 days;

    /// @notice Token ERC-20 que custodia la tesorería.
    IERC20 public immutable token;

    /// @notice Límites de operación vigentes.
    Limits public limits;

    /// @notice Identificador que recibirá la próxima solicitud.
    uint256 public nextRequestId;

    /// @notice Indica si una dirección está habilitada para recibir retiros.
    mapping(address => bool) public isAllowedBeneficiary;

    /// @notice Gasto por día (clave: block.timestamp / 1 days).
    mapping(uint256 => DailySpend) public spentPerDay;

    /// @notice Solicitudes de retiro por identificador.
    mapping(uint256 => WithdrawalRequest) public requests;

    // ------------------------------------------------------------------
    // Eventos
    // ------------------------------------------------------------------

    /// @notice Se emite al depositar tokens.
    /// @param from Dirección que deposita.
    /// @param amount Cantidad depositada.
    event Deposited(address indexed from, uint256 amount);

    /// @notice Se emite al ejecutar un retiro (directo o aprobado).
    /// @param to Destinatario.
    /// @param amount Cantidad retirada.
    /// @param operator Operador que originó el retiro (en los aprobados, quien lo solicitó).
    event Withdrawn(address indexed to, uint256 amount, address indexed operator);

    /// @notice Se emite al crear una solicitud que requiere aprobación.
    /// @param requestId Identificador de la solicitud.
    /// @param to Destinatario.
    /// @param amount Cantidad pedida.
    /// @param requester Operador que pidió.
    event WithdrawalRequested(
        uint256 indexed requestId,
        address indexed to,
        uint256 amount,
        address indexed requester
    );

    /// @notice Se emite al aprobar y ejecutar una solicitud.
    /// @param requestId Identificador de la solicitud.
    /// @param approver Aprobador que firmó.
    event WithdrawalRequestApproved(uint256 indexed requestId, address indexed approver);

    /// @notice Se emite al rechazar o cancelar una solicitud.
    /// @param requestId Identificador de la solicitud.
    /// @param rejecter Cuenta que la rechazó.
    event WithdrawalRejected(uint256 indexed requestId, address indexed rejecter);

    /// @notice Se emite al habilitar o deshabilitar un destinatario.
    /// @param beneficiary Dirección afectada.
    /// @param allowed Nuevo estado.
    event BeneficiaryUpdated(address indexed beneficiary, bool allowed);

    /// @notice Se emite al cambiar los límites.
    /// @param perTxLimit Nuevo límite por operación.
    /// @param dailyLimit Nuevo tope diario.
    /// @param approvalThreshold Nuevo umbral de doble firma.
    /// @param directDailyLimit Nuevo tope diario sin doble firma.
    event LimitsUpdated(
        uint96 perTxLimit,
        uint96 dailyLimit,
        uint96 approvalThreshold,
        uint96 directDailyLimit
    );

    // ------------------------------------------------------------------
    // Errores
    // ------------------------------------------------------------------

    /// @notice Una dirección obligatoria es la dirección cero.
    error ZeroAddress();

    /// @notice La dirección del token no tiene código: no es un contrato.
    /// @param account Dirección recibida.
    error NotAContract(address account);

    /// @notice Operador y aprobador deben ser cuentas distintas.
    error RolesMustBeDistinct();

    /// @notice El monto debe ser mayor que cero.
    error ZeroAmount();

    /// @notice Los límites no cumplen los invariantes.
    error InvalidLimits();

    /// @notice El retiro es igual o mayor al umbral y debe pasar por doble firma.
    /// @param amount Monto pedido.
    /// @param threshold Umbral vigente.
    error RequiresApproval(uint256 amount, uint256 threshold);

    /// @notice El monto es menor al umbral: debe usarse el retiro directo.
    /// @param amount Monto pedido.
    /// @param threshold Umbral vigente.
    error BelowApprovalThreshold(uint256 amount, uint256 threshold);

    /// @notice El destinatario no está habilitado.
    /// @param to Dirección rechazada.
    error BeneficiaryNotAllowed(address to);

    /// @notice El monto supera el límite por operación.
    /// @param amount Monto pedido.
    /// @param limit Límite vigente.
    error ExceedsPerTxLimit(uint256 amount, uint256 limit);

    /// @notice El retiro haría superar el tope diario.
    /// @param totalToday Total del día incluyendo este retiro.
    /// @param limit Tope diario vigente.
    error ExceedsDailyLimit(uint256 totalToday, uint256 limit);

    /// @notice El retiro haría superar el tope diario sin doble firma.
    /// @param directToday Total directo del día incluyendo este retiro.
    /// @param limit Tope diario directo vigente.
    error ExceedsDirectDailyLimit(uint256 directToday, uint256 limit);

    /// @notice La solicitud no está pendiente.
    /// @param requestId Identificador consultado.
    /// @param status Estado actual.
    error NotPending(uint256 requestId, Status status);

    /// @notice La solicitud venció.
    /// @param requestId Identificador consultado.
    /// @param expiresAt Momento de vencimiento.
    error RequestExpired(uint256 requestId, uint256 expiresAt);

    /// @notice Quien solicitó el retiro no puede aprobarlo.
    error SelfApprovalNotAllowed();

    /// @notice La cuenta no puede rechazar esta solicitud.
    /// @param account Cuenta que lo intentó.
    error NotAuthorizedToReject(address account);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /// @notice Despliega la tesorería y reparte los roles.
    /// @dev Quien despliega NO recibe ningún rol: el admin es el timelock.
    /// @param token_ Token ERC-20 a custodiar.
    /// @param timelock Contrato timelock que será DEFAULT_ADMIN_ROLE.
    /// @param operator Cuenta con OPERATOR_ROLE.
    /// @param approver Cuenta con APPROVER_ROLE.
    /// @param guardian Cuenta con GUARDIAN_ROLE.
    /// @param initialBeneficiaries Destinatarios habilitados desde el inicio.
    /// @param initialLimits Límites iniciales.
    constructor(
        address token_,
        address timelock,
        address operator,
        address approver,
        address guardian,
        address[] memory initialBeneficiaries,
        Limits memory initialLimits
    ) {
        if (
            token_ == address(0) ||
            timelock == address(0) ||
            operator == address(0) ||
            approver == address(0) ||
            guardian == address(0)
        ) revert ZeroAddress();
        if (token_.code.length == 0) revert NotAContract(token_);
        if (operator == approver) revert RolesMustBeDistinct();

        token = IERC20(token_);
        _setLimits(initialLimits);

        uint256 len = initialBeneficiaries.length;
        for (uint256 i; i < len; ++i) {
            _setBeneficiary(initialBeneficiaries[i], true);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(APPROVER_ROLE, approver);
        _grantRole(GUARDIAN_ROLE, guardian);
    }

    // ------------------------------------------------------------------
    // Funciones externas: operación
    // ------------------------------------------------------------------

    /// @notice Deposita tokens en la tesorería.
    /// @dev Requiere approve previo del usuario a esta tesorería.
    /// @param amount Cantidad a depositar.
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        emit Deposited(msg.sender, amount);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Retiro directo para montos menores al umbral de doble firma.
    /// @dev Además del tope diario general, respeta un tope diario propio para
    ///      que no se pueda evadir la doble firma fraccionando retiros.
    /// @param to Destinatario habilitado.
    /// @param amount Cantidad a retirar.
    function withdraw(address to, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        Limits memory l = limits;
        if (amount >= l.approvalThreshold) revert RequiresApproval(amount, l.approvalThreshold);

        _checkAndRecordSpend(to, amount, l, true); // CHECKS + EFFECTS
        emit Withdrawn(to, amount, msg.sender);
        token.safeTransfer(to, amount); // INTERACTIONS
    }

    /// @notice Pide un retiro igual o mayor al umbral; queda pendiente de aprobación.
    /// @param to Destinatario habilitado.
    /// @param amount Cantidad a retirar.
    /// @return requestId Identificador de la solicitud creada.
    function requestWithdrawal(address to, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        returns (uint256 requestId)
    {
        Limits memory l = limits;
        if (amount < l.approvalThreshold) revert BelowApprovalThreshold(amount, l.approvalThreshold);
        if (!isAllowedBeneficiary[to]) revert BeneficiaryNotAllowed(to);
        if (amount > l.perTxLimit) revert ExceedsPerTxLimit(amount, l.perTxLimit);

        requestId = nextRequestId++;
        // amount <= perTxLimit (uint96): la conversión no pierde datos.
        // block.timestamp + 3 días entra en uint40 hasta el año 36812.
        requests[requestId] = WithdrawalRequest({
            to: to,
            amount: uint96(amount),
            requester: msg.sender,
            status: Status.Pending,
            expiresAt: uint40(block.timestamp + REQUEST_TTL)
        });
        emit WithdrawalRequested(requestId, to, amount, msg.sender);
    }

    /// @notice Segunda firma: aprueba y ejecuta una solicitud pendiente y vigente.
    /// @dev Vuelve a validar allowlist y límites al momento de ejecutar.
    /// @param requestId Solicitud a aprobar.
    function approveWithdrawal(uint256 requestId)
        external
        onlyRole(APPROVER_ROLE)
        whenNotPaused
        nonReentrant
    {
        WithdrawalRequest storage req = requests[requestId];
        if (req.status != Status.Pending) revert NotPending(requestId, req.status);
        if (block.timestamp > req.expiresAt) revert RequestExpired(requestId, req.expiresAt);
        if (req.requester == msg.sender) revert SelfApprovalNotAllowed();

        address to = req.to;
        uint256 amount = req.amount;

        req.status = Status.Executed; // EFFECTS
        _checkAndRecordSpend(to, amount, limits, false); // CHECKS + EFFECTS
        emit WithdrawalRequestApproved(requestId, msg.sender);
        emit Withdrawn(to, amount, req.requester);
        token.safeTransfer(to, amount); // INTERACTIONS
    }

    /// @notice Rechaza (o cancela) una solicitud pendiente.
    /// @dev Pueden hacerlo APPROVER_ROLE, GUARDIAN_ROLE o el propio solicitante,
    ///      incluso con la tesorería pausada.
    /// @param requestId Solicitud a rechazar.
    function rejectWithdrawal(uint256 requestId) external {
        WithdrawalRequest storage req = requests[requestId];
        if (
            !hasRole(APPROVER_ROLE, msg.sender) &&
            !hasRole(GUARDIAN_ROLE, msg.sender) &&
            req.requester != msg.sender
        ) revert NotAuthorizedToReject(msg.sender);
        if (req.status != Status.Pending) revert NotPending(requestId, req.status);

        req.status = Status.Rejected;
        emit WithdrawalRejected(requestId, msg.sender);
    }

    // ------------------------------------------------------------------
    // Funciones externas: administración (vía timelock)
    // ------------------------------------------------------------------

    /// @notice Habilita o deshabilita un destinatario.
    /// @param beneficiary Dirección a actualizar.
    /// @param allowed true habilita, false deshabilita.
    function setBeneficiary(address beneficiary, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setBeneficiary(beneficiary, allowed);
    }

    /// @notice Reemplaza los límites de operación.
    /// @param newLimits Nuevos límites.
    function setLimits(Limits calldata newLimits) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setLimits(newLimits);
    }

    /// @notice Reanuda la operación después de una pausa.
    /// @dev Solo el timelock: pausar es inmediato, reanudar espera el delay.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Funciones externas: emergencia (guardian)
    // ------------------------------------------------------------------

    /// @notice Pausa de emergencia: bloquea depósitos, retiros y aprobaciones.
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /// @notice Deshabilita de inmediato un beneficiario comprometido.
    /// @dev El guardián solo puede quitar; habilitar sigue pasando por el timelock.
    /// @param beneficiary Dirección a deshabilitar.
    function revokeBeneficiary(address beneficiary) external onlyRole(GUARDIAN_ROLE) {
        _setBeneficiary(beneficiary, false);
    }

    // ------------------------------------------------------------------
    // Funciones externas: lectura
    // ------------------------------------------------------------------

    /// @notice Cuanto queda disponible hoy, en total y sin doble firma.
    /// @return remainingTotal Restante del tope diario general.
    /// @return remainingDirect Restante del tope diario directo.
    function remainingToday()
        external
        view
        returns (uint256 remainingTotal, uint256 remainingDirect)
    {
        DailySpend memory s = spentPerDay[block.timestamp / 1 days];
        Limits memory l = limits;
        remainingTotal = s.total >= l.dailyLimit ? 0 : l.dailyLimit - s.total;
        remainingDirect = s.direct >= l.directDailyLimit ? 0 : l.directDailyLimit - s.direct;
    }

    // ------------------------------------------------------------------
    // Funciones privadas
    // ------------------------------------------------------------------

    /// @dev Valida destinatario y límites, y registra el gasto del día.
    /// @param to Destinatario.
    /// @param amount Monto.
    /// @param l Límites ya leídos de storage.
    /// @param isDirect true si es un retiro sin doble firma.
    function _checkAndRecordSpend(
        address to,
        uint256 amount,
        Limits memory l,
        bool isDirect
    ) private {
        if (!isAllowedBeneficiary[to]) revert BeneficiaryNotAllowed(to);
        if (amount > l.perTxLimit) revert ExceedsPerTxLimit(amount, l.perTxLimit);

        uint256 day = block.timestamp / 1 days;
        DailySpend memory s = spentPerDay[day];

        uint256 totalToday = s.total + amount;
        if (totalToday > l.dailyLimit) revert ExceedsDailyLimit(totalToday, l.dailyLimit);

        uint256 directToday = s.direct;
        if (isDirect) {
            directToday += amount;
            if (directToday > l.directDailyLimit) {
                revert ExceedsDirectDailyLimit(directToday, l.directDailyLimit);
            }
        }

        // Ambos valores son <= dailyLimit (uint96), entran en uint128.
        spentPerDay[day] = DailySpend(uint128(totalToday), uint128(directToday));
    }

    /// @dev Valida los invariantes de límites y los guarda.
    /// @param l Límites propuestos.
    function _setLimits(Limits memory l) private {
        if (
            l.approvalThreshold == 0 ||
            l.approvalThreshold > l.perTxLimit ||
            l.perTxLimit > l.dailyLimit ||
            l.directDailyLimit == 0 ||
            l.directDailyLimit > l.dailyLimit
        ) revert InvalidLimits();

        limits = l;
        emit LimitsUpdated(l.perTxLimit, l.dailyLimit, l.approvalThreshold, l.directDailyLimit);
    }

    /// @dev Actualiza la allowlist.
    /// @param beneficiary Dirección a actualizar.
    /// @param allowed Nuevo estado.
    function _setBeneficiary(address beneficiary, bool allowed) private {
        if (beneficiary == address(0)) revert ZeroAddress();
        isAllowedBeneficiary[beneficiary] = allowed;
        emit BeneficiaryUpdated(beneficiary, allowed);
    }
}