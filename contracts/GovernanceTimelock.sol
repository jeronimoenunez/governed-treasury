// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title GovernanceTimelock
/// @author Jerónimo Núñez
/// @notice Período de enfriamiento obligatorio para cambios de configuración de la tesorería.
/// @dev Envoltorio del TimelockController de OpenZeppelin. Es el DEFAULT_ADMIN_ROLE de
///      GovernedTreasury: toda operación administrativa se programa (schedule), espera
///      minDelay segundos y recién después se ejecuta (execute). Durante la espera,
///      cualquier cuenta con CANCELLER_ROLE puede cancelarla.
contract GovernanceTimelock is TimelockController {
    /// @notice Despliega el timelock.
    /// @param minDelay Espera mínima en segundos entre programar y ejecutar.
    /// @param proposers Cuentas que pueden programar y cancelar operaciones.
    /// @param executors Cuentas que pueden ejecutar operaciones vencidas.
    /// @param admin Admin temporal para configurar roles; address(0) si no hace falta.
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}