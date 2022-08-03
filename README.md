## Booster pool

This repository contains the smart contracts for the [Booster Pool](https://boosterpool.xyz/) protocol.

Booster Pool contract allows users to add liquidity for specified Uniswap v3 pair in exchange of Booster Pool ERC20 token as a proof of liquidity share. Booster Pool strategy address manages Booster Pool liquidity in exchange of protocol fees (feeA and feeB is reserved for various reasons). Booster Pool is based on [AlphaVault contract](https://github.com/charmfinance/alpha-vaults-contracts/blob/main/contracts/AlphaVault.sol), but uses different approach to the deposit/burn token proportion. Booster Pool's proportion equals to Uniswap position liquidity proportion at the time of the deposit. Funds that happen to be out of proportion are left on the contract waiting for the rebalace from strategy. In case of contract deactivation burn rule changes from Uniswap share proportion to contract balance proportion. 
