// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GovernedTreasury} from "../../contracts/GovernedTreasury.sol";
import {PocBase} from "./PocBase.sol";

/// @title FeeToken
/// @notice Token de prueba que cobra 1 % de comisión en cada transferencia (la quema).
/// @dev Vive acá y no en contracts/mocks/ porque contracts/ no se toca (spec 008, RNF-T1).
contract FeeToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    /// @notice Emite tokens sin comisión.
    /// @param to Destinatario.
    /// @param amount Cantidad.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev En transferencias entre cuentas, el 1 % se quema y llega el 99 %.
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) return super._update(from, to, value);
        uint256 fee = value / 100;
        super._update(from, address(0), fee);
        super._update(from, to, value - fee);
    }
}

/// @title PoC GT-04: con un token con comisión, Deposited no coincide con lo recibido
/// @notice Hallazgo GT-04 (Informativa). deposit() emite el monto pedido, no el que llegó.
///         Quien concilie con eventos (el panel, el monitor) va a sumar de más.
/// @dev Este test PASA mientras el comportamiento siga. mARS no cobra comisión: el riesgo
///      aparece solo si se despliega con otro token. La otra mitad del hallazgo (tokens ajenos
///      mandados por error quedan trabados) es una ausencia de función y no tiene PoC.
contract PoC_GT04_TokenConComision is PocBase {
    event Deposited(address indexed from, uint256 amount);

    /// @notice Se depositan 1.000: el evento dice 1.000 y la bóveda recibe 990.
    function test_PoC_GT04_DepositedNoCoincideConLoRecibido() public {
        FeeToken fee = new FeeToken();
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary;
        (uint96 perTx, uint96 daily, uint96 threshold, uint96 direct) = treasury.limits();
        GovernedTreasury feeTreasury = new GovernedTreasury(
            address(fee),
            address(timelock),
            operator,
            approver,
            guardian,
            beneficiaries,
            GovernedTreasury.Limits(perTx, daily, threshold, direct)
        );

        address user = makeAddr("depositante");
        fee.mint(user, 1_000e18);
        vm.startPrank(user);
        fee.approve(address(feeTreasury), 1_000e18);

        vm.expectEmit(true, false, false, true, address(feeTreasury));
        emit Deposited(user, 1_000e18);
        feeTreasury.deposit(1_000e18);
        vm.stopPrank();

        assertEq(fee.balanceOf(address(feeTreasury)), 990e18, "llegaron 990, no 1.000");
    }
}
