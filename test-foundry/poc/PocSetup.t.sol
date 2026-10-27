// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PocBase} from "./PocBase.sol";

/// @title Sanidad de la base de las PoC
/// @notice Comprueba que PocBase quedó configurada igual que Sepolia, con los mismos
///         chequeos que corre scripts/deploy.js después de desplegar.
contract PocSetupTest is PocBase {
    function test_PocBase_ReplicaElDeploy() public view {
        bytes32 admin = treasury.DEFAULT_ADMIN_ROLE();
        assertTrue(treasury.hasRole(admin, address(timelock)), "timelock admin de la tesoreria");
        assertFalse(treasury.hasRole(admin, deployer), "deployer sin admin en la tesoreria");
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), deployer), "deployer sin admin en el timelock");
        assertTrue(treasury.hasRole(treasury.OPERATOR_ROLE(), operator));
        assertTrue(treasury.hasRole(treasury.APPROVER_ROLE(), approver));
        assertTrue(treasury.hasRole(treasury.GUARDIAN_ROLE(), guardian));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), guardian), "guardian puede cancelar");
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), proposer));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), proposer));
        assertTrue(treasury.isAllowedBeneficiary(beneficiary));
        assertEq(timelock.getMinDelay(), DELAY);
        assertEq(token.balanceOf(address(treasury)), INITIAL);
    }
}
