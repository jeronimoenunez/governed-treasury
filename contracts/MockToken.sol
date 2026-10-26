// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockToken
/// @notice Token ERC-20 de prueba que funciona como la "moneda" de la bóveda.
/// @dev Solo para testnet. El owner puede emitir tokens para fondear pruebas.

contract MockToken is ERC20, Ownable {
    /// @notice Despliega el token y asigna como owner a quien lo despliega.

    constructor() ERC20("Mock Peso", "mARS") Ownable(msg.sender) {}

    /// @notice Emite tokens nuevos hacia una dirección.
    /// @param to Dirección que recibe los tokens.
    /// @param amount Cantidad a emitir, en unidades mínimas (18 decimales).

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}