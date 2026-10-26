// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GovernedTreasury} from "../contracts/GovernedTreasury.sol";
import {MockToken} from "../contracts/MockToken.sol";
import {TreasuryBase} from "./GovernedTreasury.fuzz.t.sol";

/// @title Handler
/// @notice Actor que Foundry usa para atacar la tesorería: llama funciones en orden aleatorio,
///         con montos aleatorios, desde cuentas con y sin rol, y adelanta el tiempo.
///         Lleva la cuenta "fantasma" (ghost) de lo que realmente salió.
contract Handler is Test {
    GovernedTreasury internal treasury;
    MockToken internal token;
    address internal operator;
    address internal approver;
    address internal guardian;
    address internal beneficiary;
    address internal attacker;
    address internal dual; // tiene rol de operador Y de aprobador (escenario de colusión)

    uint256 public totalOut;
    bool public attackSucceeded;
    uint256[] internal pending;

    constructor(
        GovernedTreasury treasury_,
        MockToken token_,
        address operator_,
        address approver_,
        address guardian_,
        address beneficiary_,
        address attacker_,
        address dual_
    ) {
        treasury = treasury_;
        token = token_;
        operator = operator_;
        approver = approver_;
        guardian = guardian_;
        beneficiary = beneficiary_;
        attacker = attacker_;
        dual = dual_;
    }

    function withdraw(uint256 amount) external {
        amount = bound(amount, 1, 1_200e18);
        vm.prank(operator);
        try treasury.withdraw(beneficiary, amount) {
            totalOut += amount;
        } catch {}
    }

    function request(uint256 amount) external {
        amount = bound(amount, 400e18, 1_200e18);
        vm.prank(operator);
        try treasury.requestWithdrawal(beneficiary, amount) returns (uint256 id) {
            pending.push(id);
        } catch {}
    }

    function approve(uint256 seed) external {
        if (pending.length == 0) return;
        uint256 id = pending[seed % pending.length];
        (, uint96 amount,,,) = treasury.requests(id);
        vm.prank(approver);
        try treasury.approveWithdrawal(id) {
            totalOut += amount;
        } catch {}
    }

    function reject(uint256 seed) external {
        if (pending.length == 0) return;
        vm.prank(guardian);
        try treasury.rejectWithdrawal(pending[seed % pending.length]) {} catch {}
    }

    /// @dev Ataques: si alguno funciona, la invariante correspondiente falla.
    function attackerWithdraws(uint256 amount) external {
        amount = bound(amount, 1, 1_000e18);
        vm.prank(attacker);
        try treasury.withdraw(attacker, amount) {
            attackSucceeded = true;
        } catch {}
    }

    function operatorPaysAttacker(uint256 amount) external {
        amount = bound(amount, 1, 499e18);
        vm.prank(operator);
        try treasury.withdraw(attacker, amount) {
            attackSucceeded = true;
        } catch {}
    }

    function operatorSelfApproves(uint256 seed) external {
        if (pending.length == 0) return;
        uint256 id = pending[seed % pending.length];
        vm.prank(operator);
        try treasury.approveWithdrawal(id) {
            attackSucceeded = true;
        } catch {}
    }

    /// @dev Una cuenta con los dos roles pide y se intenta aprobar a sí misma.
    function dualSelfApproves(uint256 amount) external {
        amount = bound(amount, 500e18, 1_000e18);
        vm.prank(dual);
        try treasury.requestWithdrawal(beneficiary, amount) returns (uint256 id) {
            pending.push(id);
            vm.prank(dual);
            try treasury.approveWithdrawal(id) {
                attackSucceeded = true;
            } catch {}
        } catch {}
    }

    function passTime(uint256 secs) external {
        secs = bound(secs, 1 hours, 2 days);
        vm.warp(block.timestamp + secs);
    }
}

/// @title Invariantes de GovernedTreasury
/// @notice Reglas que tienen que cumplirse SIEMPRE, después de cualquier secuencia de acciones.
contract GovernedTreasuryInvariantTest is TreasuryBase {
    Handler internal handler;

    function setUp() public override {
        super.setUp();
        // Colusión: vía timelock (el único admin) una cuenta recibe los dos roles.
        address dual = makeAddr("operador-aprobador");
        vm.startPrank(address(timelock));
        treasury.grantRole(treasury.OPERATOR_ROLE(), dual);
        treasury.grantRole(treasury.APPROVER_ROLE(), dual);
        vm.stopPrank();
        handler = new Handler(treasury, token, operator, approver, guardian, beneficiary, attacker, dual);
        targetContract(address(handler));
    }

    /// @notice Conservación: lo que hay en la bóveda es lo que entró menos lo que salió por vías legítimas.
    function invariant_ConservacionDeFondos() public view {
        assertEq(token.balanceOf(address(treasury)), INITIAL - handler.totalOut());
        assertEq(token.balanceOf(beneficiary), handler.totalOut());
    }

    /// @notice Ningún ataque logra mover fondos: el atacante nunca recibe nada.
    function invariant_NingunAtaqueFunciona() public view {
        assertFalse(handler.attackSucceeded(), "un ataque logro ejecutarse");
        assertEq(token.balanceOf(attacker), 0);
    }

    /// @notice Los topes del día se respetan siempre.
    function invariant_TopesDiarios() public view {
        (uint128 total, uint128 direct) = treasury.spentPerDay(block.timestamp / 1 days);
        assertLe(total, 3_000e18, "se supero el tope diario");
        assertLe(direct, 1_000e18, "se supero el tope sin doble firma");
    }

    /// @notice Nadie fuera del timelock es admin de la tesorería.
    function invariant_SoloElTimelockEsAdmin() public view {
        bytes32 admin = treasury.DEFAULT_ADMIN_ROLE();
        assertTrue(treasury.hasRole(admin, address(timelock)));
        assertFalse(treasury.hasRole(admin, address(this)));
        assertFalse(treasury.hasRole(admin, operator));
    }
}
