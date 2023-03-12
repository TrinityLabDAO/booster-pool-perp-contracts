// SPDX-License-Identifier: MIT
// Copyright (c) 2021 TrinityLabDAO

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
pragma solidity 0.8.7;
pragma abicoder v2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IVault.sol";
import "@perp/curie-contract/contracts/interface/IVault.sol";
import "./interface/IClearingHouse.sol";

import "github.com/Uniswap/v3-core/blob/0.8/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/PositionKey.sol";
import "./libraries/LiquidityAmounts.sol";

/**
 * @title   Booster pool
 * @notice  A pool that provides liquidity on Uniswap V3.
 */


contract Perp_Booster_Demo is Ownable {
    IVault public immutable vault;
    IClearingHouse public immutable clearningHouse;
    IUniswapV3Pool public immutable pool;
    using SafeERC20 for IERC20;

    uint160 public lastTwap;
    uint128 public lastliquidity;
    uint24 public leverage;
    int24 public Lower;
    int24 public Upper;
    

    //constructor(address _vault, address _clearningHouse) {
    constructor() {
        //vault = IVault(_vault);//0xAD7b4C162707E0B2b5f6fdDbD3f8538A5fbA0d60
        vault = IVault(0xAD7b4C162707E0B2b5f6fdDbD3f8538A5fbA0d60);

        pool = IUniswapV3Pool(0x36B18618c4131D8564A714fb6b4D2B1EdADc0042);

        //clearningHouse = IClearingHouse(_clearningHouse);//0x82ac2CE43e33683c58BE4cDc40975E73aA50f459);
        clearningHouse = IClearingHouse(0x82ac2CE43e33683c58BE4cDc40975E73aA50f459);

        leverage = 3;
    }

    function setLeverage(uint24 newLeverage)external{
        leverage = newLeverage;
    }

    function approve(address token, uint256 amount)external{
        IERC20(token).approve(address(vault), amount);
    }

//
//Deposit
//
    function perp_deposit(address token, uint256 amount) external  {
        if (amount > 0) IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        vault.deposit(token, amount); 
        //TODO: mint LP tokens
    }

    function perp_depositETH() public payable {
        vault.depositEtherFor(msg.sender); 
    }

    function perp_deposit2(address token, uint256 amount) external  {
        if (amount > 0) IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).approve(address(vault), amount);
        vault.deposit(token, amount); 
    }

//
//Withdraw
//
    function perp_withdraw(address token, uint256 amount) onlyOwner external {
        //TODO: remove Liqudity
        vault.withdraw(token, amount);
        IERC20(token).safeTransfer(msg.sender, amount);
    }

//
//Info
//
    function getPerpBalance(address trader, address token) external view returns (int256 amount) {
        return vault.getBalanceByToken(trader, token);
    }

    function getSqrtRatioAtTick(int24 tick) external pure returns (uint256){
        return TickMath.getSqrtRatioAtTick(tick);
    }
//
//Liqudity
//

    event Values(uint256 base, uint256 quote);

    function addLiquidity(uint160 twap, uint256 freeCollateral, int24 tickLower, int24 tickUpper) onlyOwner external returns (IClearingHouse.AddLiquidityResponse memory){

        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        //TODO: depositAmount check perp buyingPower
        //uint256 freeCollaterel = vault.getFreeCollaterel(address(this));
        //6 decimals to 18
        uint256 depositAmount = freeCollateral * 1e12 * leverage;
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
                sqrtRatioAX96,
                sqrtRatioBX96,
                depositAmount
            );
        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                sqrtRatioAX96,
                sqrtRatioBX96,
                liquidity
            );
        IClearingHouse.AddLiquidityParams memory params;
        params.baseToken = pool.token0();//baseToken;
        params.base = amount0;
        params.quote = amount1;
        params.lowerTick = tickLower;
        params.upperTick = tickUpper;
        params.minBase = 0;
        params.minQuote = 0;
        params.useTakerBalance = false;
        params.deadline = 999999999999999999999999;

        Lower = tickLower;
        Upper = tickUpper;
        emit Values(amount0, amount1);

        lastliquidity = liquidity;
        lastTwap = twap;
        return clearningHouse.addLiquidity(params);
    }

    function addLiquidityBase(
        IClearingHouse.AddLiquidityParams calldata params
        ) onlyOwner external returns (IClearingHouse.AddLiquidityResponse memory){
        return clearningHouse.addLiquidity(params);
    }

    function removeLiquidity(
        IClearingHouse.RemoveLiquidityParams calldata params
        ) onlyOwner external returns (IClearingHouse.RemoveLiquidityResponse memory){
         return clearningHouse.removeLiquidity(params);
    }

    function getLiqudity() public view returns (uint128) {
        //iquidity uint128, feeGrowthInside0LastX128 uint256, feeGrowthInside1LastX128 uint256, tokensOwed0 uint128, tokensOwed1 uint128
        (uint128 liquidity, , , ,) = pool.positions(
            PositionKey.compute(address(this), Lower, Upper)
            );
        return liquidity;
    }
}