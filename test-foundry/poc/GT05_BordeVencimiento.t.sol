// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {GovernedTreasury} from "../../contracts/GovernedTreasury.sol";
import {PocBase} from "./PocBase.sol";

/// @title PoC GT-05: un pedido se puede aprobar en el segundo exacto de expiresAt
/// @notice Hallazgo GT-05 (Informativa). approveWithdrawal compara block.timestamp > expiresAt:
///         en expiresAt el pedido todavía vale. La otra mitad del hallazgo (el umbral de doble
///         firma no se revalida al aprobar) no tiene PoC propia.
/// @dev Este test PASA mientras el borde siga abierto. El impacto es un segundo de más.
contract PoC_GT05_BordeVencimiento is PocBase {
    /// @notice En expiresAt el pedido se aprueba; en expiresAt + 1, revierte con RequestExpired.
    function test_PoC_GT05_SeApruebaEnElSegundoExactoDelVencimiento() public {
        vm.prank(operator);
        uint256 a = treasury.requestWithdrawal(beneficiary, 600e18);
        vm.prank(operator);
        uint256 b = treasury.requestWithdrawal(beneficiary, 600e18);
        (,,,, uint40 expiresAt) = treasury.requests(a);

        vm.warp(expiresAt);
        vm.prank(approver);
        treasury.approveWithdrawal(a);
        (,,, GovernedTreasury.Status status,) = treasury.requests(a);
        assertEq(uint8(status), uint8(GovernedTreasury.Status.Executed), "aprobado en el segundo exacto");

        vm.warp(uint256(expiresAt) + 1);
        vm.expectRevert(abi.encodeWithSelector(GovernedTreasury.RequestExpired.selector, b, expiresAt));
        vm.prank(approver);
        treasury.approveWithdrawal(b);
    }
}
