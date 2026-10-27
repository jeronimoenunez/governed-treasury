// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GovernedTreasury} from "../../contracts/GovernedTreasury.sol";
import {GovernanceTimelock} from "../../contracts/GovernanceTimelock.sol";
import {MockToken} from "../../contracts/MockToken.sol";

/// @title PocBase
/// @notice Base de las pruebas de concepto (PoC) del red team (spec 008).
/// @dev Replica scripts/deploy.js paso a paso, no TreasuryBase: acá el guardián tiene
///      CANCELLER_ROLE en el timelock y el deployer renuncia al admin temporal, igual que
///      en Sepolia. Sin eso, GT-01 no se podría reproducir.
abstract contract PocBase is Test {
    GovernedTreasury internal treasury;
    GovernanceTimelock internal timelock;
    MockToken internal token;

    address internal deployer = makeAddr("deployer");
    address internal operator = makeAddr("operador");
    address internal approver = makeAddr("aprobador");
    address internal guardian = makeAddr("guardian");
    address internal proposer = makeAddr("proponente");
    address internal beneficiary = makeAddr("beneficiario");
    address internal attacker = makeAddr("atacante");

    // Mismos valores que DELAY, LIMITS e INITIAL_FUNDING de scripts/deploy.js.
    uint256 internal constant DELAY = 72 hours;
    uint256 internal constant INITIAL = 10_000e18;

    function setUp() public virtual {
        vm.startPrank(deployer);

        // 1. Token
        token = new MockToken();

        // 2. Timelock: el proponente programa y ejecuta; el deployer es admin temporal.
        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        timelock = new GovernanceTimelock(DELAY, proposers, proposers, deployer);
        timelock.grantRole(timelock.CANCELLER_ROLE(), guardian);
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);

        // 3. Tesorería
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = beneficiary;
        treasury = new GovernedTreasury(
            address(token),
            address(timelock),
            operator,
            approver,
            guardian,
            beneficiaries,
            GovernedTreasury.Limits({
                perTxLimit: 1_000e18,
                dailyLimit: 3_000e18,
                approvalThreshold: 500e18,
                directDailyLimit: 1_000e18
            })
        );

        // 4. Fondeo inicial
        token.mint(deployer, INITIAL);
        token.approve(address(treasury), INITIAL);
        treasury.deposit(INITIAL);

        vm.stopPrank();
    }
}
