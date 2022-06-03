const { ethers } = require("ethers");
const abi_erc20 = require('./abis/abi_erc20.json');
const abi_uniswapV3Factory = require('./abis/abi_uniswapV3Factory.json');
const abi_uniswapV3PositionManager = require('./abis/abi_uniswapV3PositionManager.json');
const abi_uniswapV3Pool = require('./abis/abi_uniswapV3Pool.json');
const abi_uniswapV3Router= require('./abis/abi_uniswapRouter.json');
const abi_boosterPool = require('./abis/abi_boosterPool.json');

const { Pool, Position, NonfungiblePositionManager, nearestUsableTick } = require('@uniswap/v3-sdk/');
const { Percent, Token } = require("@uniswap/sdk-core");


class Uniswap{
    constructor(provider, net){
        this.provider = provider;
        this.net = net;

        this.boosterPool = new ethers.Contract(net.boosterPool, abi_boosterPool, provider);
        this.factoryContract = new ethers.Contract(net.factoryAddress, abi_uniswapV3Factory, provider);
        this.swapRouterContract = new ethers.Contract(net.routerAddress, abi_uniswapV3Router, provider);
        this.positionManager = new ethers.Contract(net.positionManagerAddress, abi_uniswapV3PositionManager, provider);

        this.MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n - 1n;
        this.MIN_SQRT_RATIO = 4295128739n + 1n;
    }
    async balanceOf(tokenHash, addr){
        let token = new ethers.Contract(tokenHash, abi_erc20, this.provider);
        let balance = await token.balanceOf(addr);
        if(balance.hasOwnProperty("_hex"))
        // return Number(balance) / 10 ** this.net.tokens[tokenHash.toLowerCase()].decimals;
            return BigInt(balance).toString(10);
        return false;
    }
    async approve(spender, token, amount, wallet) {
        try {
            let gasPrice = await this.provider.getGasPrice();
            gasPrice = Number(gasPrice._hex);
            console.log(gasPrice);

            const contractToken = new ethers.Contract(token, abi_erc20, this.provider);

            //ethers.utils.parseEther(amountInEther.toString())
            //spender = net.positionManagerAddress
            // call approve
            let res = await contractToken.connect(wallet).approve(spender, amount, {
                gasPrice: gasPrice,
                gasLimit: 60000
            });
            return res;
        } catch (err) {
            console.log(new Error(err));
        }
    }
    async swap(poolAddress, connectedWallet, eth_buy, amountIn){
        let immutables = await this.getPoolImmutables(poolAddress.toLowerCase());
        const params = {
            tokenIn: eth_buy ? immutables.token1 : immutables.token0,
            tokenOut: eth_buy ? immutables.token0 : immutables.token1,
            fee: immutables.fee,
            recipient: connectedWallet.address,
            deadline: Math.floor(Date.now() / 1000) + (60 * 10),
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
        }

        const transaction = this.swapRouterContract.connect(connectedWallet).exactInputSingle(
            params,
            {
                gasLimit: ethers.utils.hexlify(1000000)
            }
        ).then(transaction => {
            console.log(transaction)
        })
    }
    async getPoolAddress(token0, token1, fee){
        let _token0 = token0.toLowerCase();
        let _token1 = token1.toLowerCase();
        let _fee = fee.toString();

        let pools = this.net.pools;
        let pool = Object.keys(pools).find(p => pools[p].token0 === _token0 && pools[p].token1 === _token1 && pools[p].fee === _fee);
        if(pool)
            return pool;
        pool = Object.keys(pools).find(p => pools[p].token0 === _token1 && pools[p].token1 === _token0 && pools[p].fee === _fee);
        if(pool)
            return pool;
        pool = await this.getPoolAddressFromNode(token0, token1, fee);
        if(pool)
            return pool;
        return false;
    }
    async getPoolAddressFromNode(token0, token1, fee){
        let pool_address = await this.factoryContract.getPool(token0, token1, fee);
        return pool_address;
    }
    async getPoolImmutables(id) {
        let pool = this.net.pools[id];
        if(!pool){
            let poolContract = await this.getPoolContractByAddress(id);
            return await this.getPoolImmutablesFromNode(poolContract)
        }
        const immutables = {
            token0: pool.token0,
            token1: pool.token1,
            fee: Number(pool.fee),
            tickSpacing: Number(pool.fee) / 50,
            token0Decimals : Number(this.net.tokens[pool.token0].decimals),
            token1Decimals : Number(this.net.tokens[pool.token1].decimals),
            token0Symbol : (this.net.tokens[pool.token0].symbol),
            token1Symbol : (this.net.tokens[pool.token1].symbol)
        };
        return immutables;
    }
    async getPoolImmutablesFromNode(poolContract) {
        const immutables = {
            factory: await poolContract.factory(),
            token0: await poolContract.token0(),
            token1: await poolContract.token1(),
            fee: await poolContract.fee(),
            tickSpacing: await poolContract.tickSpacing(),
            maxLiquidityPerTick: await poolContract.maxLiquidityPerTick(),
        };
        return immutables;
    }
    async getPoolContract(token0, token1, fee){
        let poolAddress = await this.getPoolAddress(token0, token1, fee);
        let poolContract = new ethers.Contract(poolAddress, abi_uniswapV3Pool, this.provider);
        return poolContract;
    }
    getPoolContractByAddress(poolAddress){
        let _poolAddress = poolAddress.toLowerCase();
        let poolContract = new ethers.Contract(_poolAddress, abi_uniswapV3Pool, this.provider);
        return poolContract;
    }
    async getPoolInfo(poolAddress){
        const poolContract = new ethers.Contract(poolAddress, abi_uniswapV3Pool, this.provider);
        const immutables = await this.getPoolImmutables(poolAddress);
        console.log(immutables)
        const token0 = new ethers.Contract(immutables.token0, abi_erc20, this.provider);
        let amount0 = await token0.balanceOf(poolAddress);
        console.log(amount0.toString());
        const token1 = new ethers.Contract(immutables.token1, abi_erc20, this.provider);
        let amount1 = await token1.balanceOf(poolAddress);
        console.log(amount1.toString());

        let sqrtPriceX96 = amount1.div(amount0).toBigInt()

        const state = await this.getPoolState(poolContract);
        console.log(state.liquidity.toString());
        console.log(state.sqrtPriceX96.toString());
        console.log(state)
        return state;
    }
    async init(poolAddress, amount0, amount1) {
        try {
            let gasPrice = await this.provider.getGasPrice();
            gasPrice = Number(gasPrice._hex);
            console.log(gasPrice);
            let poolContract = new ethers.Contract(poolAddress, abi_uniswapV3Pool, this.provider);
            let sqrtPriceX96 = Math.sqrt(1);
            // call approve
            let res = await poolContract.connect(wallet).inilize(sqrtPriceX96, {
                gasPrice: gasPrice,
                gasLimit: 550000
            });
        }catch (e) {

        }
    }
    async createPositionCalldata(swap, balance_in, balance_out){
        try {
            const poolAddress = await this.getPoolAddress(swap.tokenIn, swap.tokenOut, swap.fee);
            const poolContract = await this.getPoolContractByAddress(poolAddress);
            const immutables = await this.getPoolImmutables(poolAddress);
            const state = await this.getPoolState(poolContract);
            console.log(state)
            let tickUsable = nearestUsableTick(state.tick, immutables.tickSpacing);
            let tickLower = (state.tick < tickUsable) ? (tickUsable - immutables.tickSpacing) : tickUsable;
            let tickUpper = tickLower + immutables.tickSpacing;

            console.log(`Ticks:  ${tickLower} <-| ${state.tick} |-> ${tickUpper}`);

            let amount0 = immutables.token0 === swap.tokenIn ? balance_in : balance_out;
            let amount1 = immutables.token1 === swap.tokenIn ? balance_in : balance_out;
            let res = await this.mevContract.populateTransaction.createPosition(poolAddress, tickLower, tickUpper, amount0, amount1);

            return {
                calldata : res.data,
                poolAddress : poolAddress,
                tickLower : tickLower,
                tickUpper : tickUpper
            };
        } catch (err) {
            console.log(new Error(err));
        }
    }
    async closePositionCalldata(poolAddress, tickLower, tickUpper){
        try {
            console.log(`Closing position:`);
            console.log(`Ticks:  ${tickLower} <-|  |-> ${tickUpper}`);
            let res = await this.mevContract.populateTransaction.closePosition(poolAddress, tickLower, tickUpper);

            return {
                calldata : res.data,
                poolAddress : poolAddress,
                tickLower : tickLower,
                tickUpper : tickUpper
            };
        } catch (err) {
            console.log(new Error(err));
        }
    }
    async closePositionWithSwapCalldata(opts){
        try {
            console.log(`Closing position:`);
            console.log(`Ticks:  ${opts.tickLower} <-|  |-> ${opts.tickUpper}`);
            let res = await this.mevContract.populateTransaction.closePositionAndSwap(
                opts.poolAddress, opts.tickLower, opts.tickUpper,
                opts.mintAmount0, opts.mintAmount1, opts.swapPoolAddress, opts.sqrtPriceLimitX96,
                opts.payAmount
            );
            return {
                calldata : res.data,
                poolAddress : opts.poolAddress,
                tickLower : opts.tickLower,
                tickUpper : opts.tickUpper
            };
        } catch (err) {
            console.log(new Error(err));
        }
    }
    async createPositionCalldataLight(swap, balance_in, balance_out){
        try {
            const poolAddress = await this.getPoolAddress(swap.tokenIn, swap.tokenOut, swap.fee);
            console.log(poolAddress);
            let liqdata = await this.calcLiquidityForPool(swap, balance_in, balance_out);


            console.log(`Creating position:`);
            console.log(`Ticks:  ${liqdata.tickLower} <-| ${liqdata.state.tick} |-> ${liqdata.tickUpper}`);
            console.log(`Liquidity: ${liqdata.liquidity}, amount0: ${liqdata.amount0}, amount1 ${liqdata.amount1}`);
            let res = await this.mevContract.populateTransaction.createPosition(poolAddress, liqdata.tickLower, liqdata.tickUpper, liqdata.liquidity);

            return {
                calldata : res.data,
                liqdata : liqdata,
                tokenPrice0 : this.getPriceFromX96(liqdata.state.sqrtPriceX96),
                poolAddress : poolAddress,
                tickLower : liqdata.tickLower,
                tickUpper : liqdata.tickUpper
            };
        } catch (err) {
            console.log(new Error(err));
        }
    }
    getxy(state, liqdata, immutables){
        let base = 1.0001;
        let d0 = immutables.token0Decimals;
        let d1 = immutables.token1Decimals;

        //let tick = 196496;
        let tickSpacing = immutables.tickSpacing;
        let tickUsable = nearestUsableTick(state.tick, tickSpacing);
        let tickLower = (state.tick < tickUsable) ? (tickUsable - tickSpacing) : tickUsable;
        let tickUpper = tickLower + tickSpacing;
        //let tickLower = 196490;
        //let tickUpper = 196500;
        let L = Number(state.liquidity);
        let sqrtPricex96 = Number(state.sqrtPriceX96);
        let Price = base ** state.tick; //
        let sqrtPrice = Math.sqrt(Price);
        //let sqrtPricex96 = 1463987728914135998262108197742596
        let Pa = base ** tickLower;
        let Pb = base ** tickUpper;
        //console.log(sqrtPrice);
        console.log(`Pa    ${tickLower} ${10**(d1 - d0) / Pa}`);
        console.log(`Price ${state.tick} ${10**(d1 - d0) / Price}`);
        console.log(`Pb    ${tickUpper} ${10**(d1 - d0) / Pb}`);
        let x = L * (Math.sqrt(Pb) - sqrtPrice) / (sqrtPrice * Math.sqrt(Pb));
        let y = L * (sqrtPrice - Math.sqrt(Pa));
        //console.log("x", x / 10**6);
        //console.log("y", y / 10**18);
        //console.log("P", Price);
        //console.log("Px96", this.getPriceFromX96(sqrtPricex96));
        //console.log(sqrtPrice);
        //console.log(L / this.getPriceFromX96(sqrtPricex96));
        //console.log(L * this.getPriceFromX96(sqrtPricex96));
        return {
            x : x / (10 ** d0),
            y : y / (10 ** d1)
        }
    }
    getPriceFromX96(x96){
        return (x96 ** 2 / 2 ** 192)
    }
    async calcLiquidityForPool(swap, balance_in, balance_out){
        const poolAddress = await this.getPoolAddress(swap.tokenIn, swap.tokenOut, swap.fee);
        const poolContract = await this.getPoolContract(swap.tokenIn, swap.tokenOut, swap.fee);
        const immutables = await this.getPoolImmutables(poolAddress);
        const state = await this.getPoolState(poolContract);
        const TknIN = new Token(this.net.CHAIN_ID, swap.tokenIn, parseInt(swap.tokenInDecimals), swap.tokenInSymbol);
        const TknOut = new Token(this.net.CHAIN_ID, swap.tokenOut, parseInt(swap.tokenOutDecimals), swap.tokenOutSymbol);

        //create a pool
        const pool = new Pool(
            immutables.token0 === swap.tokenIn ? TknIN:TknOut,
            immutables.token1 === swap.tokenIn ? TknIN:TknOut,
            immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        );

        let tickUsable = nearestUsableTick(state.tick, immutables.tickSpacing);
        let tickLower = (state.tick < tickUsable) ? (tickUsable - immutables.tickSpacing) : tickUsable;
        let tickUpper = tickLower + immutables.tickSpacing;

        let opt = {
            pool : pool,
            tickLower : tickLower,
            tickUpper : tickUpper,
            amount0 : immutables.token0 === swap.tokenIn ? balance_in : balance_out,
            amount1 : immutables.token1 === swap.tokenIn ? balance_in : balance_out,
            useFullPrecision : true
        };
        let position =  Position.fromAmounts(opt);

        return {
            curLiquidity : state.liquidity.toString(),
            liquidity: position.liquidity.toString(10),
            amount0: position.mintAmounts.amount0.toString(),
            amount1: position.mintAmounts.amount1.toString(),
            token0 : immutables.token0 === swap.tokenIn ? swap.tokenIn:swap.tokenOut,
            token1 : immutables.token1 === swap.tokenIn ? swap.tokenIn:swap.tokenOut,
            tickLower : tickLower,
            tickUpper : tickUpper,
            state : state,
            amount0h: position.amount0.toSignificant(10),
            amount1h: position.amount1.toSignificant(10),
        }
    }
    async getCurrentPrice(poolContract){
        let pool_balance = await poolContract.slot0();
        let sqrtPriceX96 = pool_balance[0];
        // console.log(pool_balance);
        // console.log(pool_balance);
        // let number_1 = BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96) *
        //     BigInt(10 ** (6)) / BigInt(10 **(18)) /
        //     (BigInt(2) ** (BigInt(192)));
        let tokenPrice0 = sqrtPriceX96 ** 2 / 2 ** 192; //token0
        let tokenPrice1 = 2 ** 192 / sqrtPriceX96 ** 2; // WETH
        // let t0_dec = await poolContract.token0();
        // let t1_dec = await poolContract.token1();
        // console.log(tokenPrice0 / 10 ** poolContract.token0().decimals);
        // console.log(tokenPrice1 / 10 ** poolContract.token1().decimals);
        sqrtPriceX96 = (BigInt(sqrtPriceX96._hex)).toString(10);
        return {
            sqrtPriceX96, tokenPrice0, tokenPrice1
        }
    }
    async swapCalldata(poolAddress, swapAmount, zeroForOne){
        try {
            let value, spl;
            if(!zeroForOne){
                value = swapAmount.mul(-1);
                spl = this.MAX_SQRT_RATIO
            }
            else{
                value = swapAmount;
                spl = this.MIN_SQRT_RATIO;
            }
            let res = await this.mevContract.populateTransaction.swap(poolAddress, value, spl);
            return {
                calldata : res.data,
            };
        } catch (err) {
            console.log(new Error(err));
        }
    }
    async getPoolState(poolContract) {
        const slot = await poolContract.slot0();
        const state = {
            liquidity: await poolContract.liquidity(),
            sqrtPriceX96: slot[0],
            tick: slot[1],
            unlocked: slot[6],
        };
        return state;
    }
    async getPrices(){
        let t0 = this.net.WETH;//"0x55e0718Deb3cef90B14D4155E8c939172de5b71c";
        let t1 = this.net.USDC;//"0x9C3aeE40554721405eF748DfC4a53cAC711c4b19"

        let fees = ["500", "3000", "10000"];
        let res = {};
        for(let fee of fees){
            let poolContract = await this.getPoolContract(t0, t1, Number(fee));
            let immutables = await this.getPoolImmutables(poolContract.address);
            let prices = await this.getCurrentPrice(poolContract);
            let priceUSDC = (prices.tokenPrice0 / 10 ** (immutables.token1Decimals - immutables.token0Decimals));
            let str01 = `1 ${immutables.token0Symbol} = ${priceUSDC} ${immutables.token1Symbol}`;
            let str10 = `1 ${immutables.token1Symbol} = ${1 / priceUSDC} ${immutables.token0Symbol}`;
            console.log(`${poolContract.address} ${Number(immutables.fee) / 10000}%\t${str01} ${str10}`);
            res[fee] = priceUSDC;
        }
        return res;
    }
    async updateCache(){
        console.log(`Uniswap caching is disabled`)
    }
}



module.exports = {
    Uniswap
};