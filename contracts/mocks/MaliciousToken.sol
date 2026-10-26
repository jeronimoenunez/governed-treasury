// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Interfaz mínima de la tesorería que el atacante necesita.
interface ITreasury {
    function withdraw(address to, uint256 amount) external;
}

/// @title MaliciousToken
/// @notice Token de ATAQUE, solo para tests: intenta reentrar en la tesorería.
/// @dev Cuando la tesorería le ordena transferir, en vez de solo mover saldo
///      vuelve a llamar a withdraw() antes de que termine la primera llamada.
contract MaliciousToken is ERC20 {
    /// @notice Tesorería atacada.
    ITreasury public treasury;

    /// @notice Destinatario usado en el ataque.
    address public beneficiary;

    /// @notice Evita que el ataque se repita infinitamente.
    bool private attacking;

    /// @notice Despliega el token de ataque.
    constructor() ERC20("Malicious", "MAL") {}

    /// @notice Configura el objetivo del ataque.
    /// @param treasury_ Tesorería a atacar.
    /// @param beneficiary_ Destinatario habilitado en la tesorería.
    function setTarget(address treasury_, address beneficiary_) external {
        treasury = ITreasury(treasury_);
        beneficiary = beneficiary_;
    }

    /// @notice Emite tokens libremente (es un mock).
    /// @param to Receptor.
    /// @param amount Cantidad.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Inicia el ataque: este contrato es el operador y pide un retiro.
    /// @param amount Monto de cada retiro.
    function attack(uint256 amount) external {
        treasury.withdraw(beneficiary, amount);
    }

    /// @dev Hook que corre en cada transferencia: acá ocurre la reentrada.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from != address(0) && from == address(treasury) && !attacking) {
            attacking = true;
            treasury.withdraw(beneficiary, value); // segunda llamada, todavía dentro de la primera
        }
    }
}
