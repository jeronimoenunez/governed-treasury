// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GovernedTreasury} from "../contracts/GovernedTreasury.sol";
import {GovernanceTimelock} from "../contracts/GovernanceTimelock.sol";
import {MockToken} from "../contracts/MockToken.sol";

/// @notice Base común: despliega el sistema igual que en Sepolia.
abstract contract TreasuryBase is Test {
    GovernedTreasury internal treasury;
    MockToken internal token;
    GovernanceTimelock internal timelock;

    address internal operator = makeAddr("operador");
    address internal approver = makeAddr("aprobador");
    address internal guardian = makeAddr("guardian");
    address internal proposer = makeAddr("proponente");
    address internal beneficiary = makeAddr("beneficiario");
    address internal attacker = makeAddr("atacante");

    uint256 internal constant INITIAL = 10_000e18;

    function setUp() public virtual {
        token = new MockToken();

        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        timelock = new GovernanceTimelock(72 hours, proposers, proposers, address(0));

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

        token.mint(address(this), INITIAL);
        token.approve(address(treasury), INITIAL);
        treasury.deposit(INITIAL);
    }
}

/// @title Fuzzing de GovernedTreasury
/// @notice Cada test recibe valores aleatorios: Foundry lo corre 1.000 veces con entradas distintas
///         buscando una que rompa la regla.
contract GovernedTreasuryFuzzTest is TreasuryBase {
    /// @notice Por más que el operador parta los retiros, nunca supera el tope directo del día.
    function testFuzz_FraccionarNoSuperaElTopeDirecto(uint256[12] memory amounts) public {
        uint256 withdrawn;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 1, 499e18); // siempre por debajo del umbral
            vm.prank(operator);
            try treasury.withdraw(beneficiary, amount) {
                withdrawn += amount;
            } catch {}
        }
        assertLe(withdrawn, 1_000e18, "se supero el tope diario sin doble firma");
        assertEq(token.balanceOf(beneficiary), withdrawn);
    }

    /// @notice Ninguna cuenta que no sea el operador puede retirar, sea cual sea el monto.
    function testFuzz_SinRolNoSePuedeRetirar(address caller, uint256 amount) public {
        vm.assume(caller != operator);
        amount = bound(amount, 1, 499e18);
        vm.prank(caller);
        vm.expectRevert();
        treasury.withdraw(beneficiary, amount);
    }

    /// @notice Ningún retiro llega a un destino que no esté agendado.
    function testFuzz_DestinoNoAgendadoSiempreRechazado(address to, uint256 amount) public {
        vm.assume(to != beneficiary && to != address(0));
        amount = bound(amount, 1, 499e18);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(GovernedTreasury.BeneficiaryNotAllowed.selector, to));
        treasury.withdraw(to, amount);
    }

    /// @notice Pedidos: cada monto cae en exactamente una de tres zonas.
    function testFuzz_PedidoRespetaUmbralYLimite(uint256 amount) public {
        amount = bound(amount, 0, 5_000e18);
        vm.prank(operator);
        if (amount < 500e18) {
            vm.expectRevert(
                abi.encodeWithSelector(GovernedTreasury.BelowApprovalThreshold.selector, amount, 500e18)
            );
            treasury.requestWithdrawal(beneficiary, amount);
        } else if (amount > 1_000e18) {
            vm.expectRevert(abi.encodeWithSelector(GovernedTreasury.ExceedsPerTxLimit.selector, amount, 1_000e18));
            treasury.requestWithdrawal(beneficiary, amount);
        } else {
            uint256 id = treasury.requestWithdrawal(beneficiary, amount);
            (, uint96 stored,,,) = treasury.requests(id);
            assertEq(stored, amount, "el monto guardado no coincide (conversion a uint96)");
        }
    }
}
