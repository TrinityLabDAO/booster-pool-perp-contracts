const Web3 = require('web3');
const privates = require('./privates');
const { ethers } = require("ethers");
const Tx = require('ethereumjs-tx').Transaction;
const addresses = require('./addresses');

const WebSocket = require('ws');

let {Uniswap} = require('./Uniswap');

const network = 'ropsten';  // mainnet goerli
let net = addresses[network];

net.geth_url    = `https://${network}.infura.io/v3/${privates.infuraKey}`;
net.geth_ws_url = `wss://${network}.infura.io/ws/v3/${privates.infuraKey}`;

const provider = new ethers.providers.WebSocketProvider(net.geth_ws_url);
const wallet = new ethers.Wallet(privates.privateKey, provider);
const web3 = new Web3(net.geth_url);
let uniswap = new Uniswap(provider, net);
const connectedWallet = wallet.connect(provider);

let poolPrices = {}
let curBlock;

const GWEI = ethers.BigNumber.from(10).pow(9);
const PRIORITY_FEE =        GWEI.mul(0);
const LEGACY_GAS_PRICE =    GWEI.mul(80);
const MINT_GASLIMIT = 250000;
const BURN_GASLIMIT = 300000;
const SWAP_GASLIMIT = 115000;

class FeeTracker {
    constructor(priorityFee){
        this.baseFee = 0;
        this.priorityFee = priorityFee;
        this.GASLIMIT_MINT = 300000;
        this.GASLIMIT_BURN = 300000;
    }
    setBaseFee(fee){
        this.baseFee = fee;
    }
    getMaxFeePerGas(fee){
        const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(curBlock.baseFeePerGas, 6);

    }
    calcBundleFeeRough(priority, pendingTx){
        let totalGasUsed = this.GASLIMIT_MINT + this.GASLIMIT_BURN;
        totalGasUsed += pendingTx.gasLimit;
        return totalGasUsed;
    }
    calcBundleFee(rawBundle, pendingTx){
        let totalGasUsed = rawBundle.reduce(
            (acc, cur) => acc + cur.transaction.gasLimit,
            0
        );
        totalGasUsed += pendingTx.gasLimit;
        return totalGasUsed;
    }
}
function getPayAmount(){
    // Set priority to 2.5
    let HALF_GWEI = GWEI.div(2);
    let PRIORITY_FEE = GWEI.mul(2).add(HALF_GWEI);
    let GAS_COST = PRIORITY_FEE.mul(MINT_GASLIMIT + BURN_GASLIMIT + SWAP_GASLIMIT);
    let MORE_TIPS = GAS_COST.mul(3);
    let amount = GAS_COST.add(MORE_TIPS);
    return amount.toString();
}
function geth_sub() {
    let on_block = {
        "jsonrpc":"2.0",
        "id": 1,
        "method": "eth_subscribe",
        "params": [
            "newHeads"
        ]
    };
    this.send(JSON.stringify(on_block));
}

function getNumbers(swap, state, liqdata, immutables){
    let xy = uniswap.getxy(state, liqdata, immutables);
    let token0price = uniswap.getPriceFromX96(state.sqrtPriceX96) / 10 ** (immutables.token1Decimals - immutables.token0Decimals);

    if(swap.tokenOut === liqdata.token1)
        token0price = 1 / token0price;
    // TODO: pool fee
    let amountOut = Number(swap.amountIn) / (10**(swap.tokenInDecimals) * token0price);
    let availableAmountOut = swap.tokenOut === liqdata.token0 ? (Number(xy.x) + Number(liqdata.amount0h)) : (Number(xy.y) + Number(liqdata.amount1h));
    let myAmountOut = swap.tokenOut === liqdata.token0 ? Number(liqdata.amount0h) : Number(liqdata.amount1h);
    let effectiveAmountOut = Math.min(amountOut, availableAmountOut);
    let feeSize = (effectiveAmountOut * Number(swap.fee) / 100000) * (Number(liqdata.liquidity) / (Number(liqdata.curLiquidity) + Number(liqdata.liquidity)));
    let toSell = (effectiveAmountOut * myAmountOut) / availableAmountOut;
    console.log(xy);
    console.log({amountOut, myAmountOut, availableAmountOut, toSell, feeSize});
    return {
        myAmountOut,
        availableAmountOut,
        feeSize,
        amountOut,
        toSell : (Math.floor(toSell * (10 ** Number(swap.tokenOutDecimals)))).toString()
    }
}

function sleep(ms){
    return new Promise(function(resolve, reject){
        setTimeout(() => resolve(), ms)
    });
}
async function getGas(){
    return parseInt(await web3.eth.getGasPrice()) + 2000000000;
}
async function createTransaction(calldata){
    try {
        let from = wallet.address;
        let to = net.boosterPool;// wallet.address;
        let count = await web3.eth.getTransactionCount(from, "pending") + 1;
        let gasPrice = await getGas();
        let rawTransaction = {
            "from": from,
            "nonce": web3.utils.toHex(count),
            "gasPrice": web3.utils.toHex(gasPrice * 5),
            "gasLimit": web3.utils.toHex(60000),
            "to": to,
            "value": "0x0",
            "data": calldata
        };
        let privKey = new Buffer.from(privates.privateKey, 'hex');

        let transaction = new Tx(rawTransaction, {chain: net.CHAIN_ID});
        transaction.sign(privKey);

        return {
            hash : ('0x' + transaction.hash().toString('hex')),
            raw : ('0x' + transaction.serialize().toString('hex'))
        };
    }
    catch (err) {
        console.log(err);
    }
}
function getRawTransactionFromObject(txobject){
    const { FeeMarketEIP1559Transaction } = require( '@ethereumjs/tx' );
    const Common = require( '@ethereumjs/common' ).default;
    const { Chain, Hardfork } = require('@ethereumjs/common');
    let chain = new Common( { chain : network, hardfork: "london" } );
    //const common =  new Common({ chain: Chain.Goerli, hardfork: Hardfork.London });
    txobject.data = txobject.input;
    if(txobject.value === "0x")
        txobject.value = web3.utils.toHex(0x0);
    txobject.gasLimit = txobject.gas;
    ['blockNumber','gasLimit','gasPrice','maxFeePerGas','maxPriorityFeePerGas','nonce','value'].map(prop => {
        txobject[prop] = web3.utils.toHex(txobject[prop])
    });

    if(txobject.hasOwnProperty('maxPriorityFeePerGas')){
        delete txobject.type;
        txobject = FeeMarketEIP1559Transaction.fromTxData( txobject , {chain});

    }
    else{
        txobject = new Tx(txobject, {chain: net.CHAIN_ID});
    }

    return `0x${txobject.serialize().toString('hex')}`;
}
async function startGeth(){
    const ws = new WebSocket(net.geth_ws_url);
    ws.on('open', geth_sub.bind(ws));
}
async function on_block(block){
    console.log("block: \t", Number(block.number), block.baseFeePerGas / 1000000000, "block receipt delay:", Date.now()/1000 - Number(block.timestamp));
    curBlock = block;
    curBlock.number = Number(curBlock.number);
    //prices()
    poolPrices = await uniswap.getPrices();
}
async function on_block_number(blockNumber){
    let block = await provider.getBlock(blockNumber);
    on_block(block);
}

async function buy_eth(poolAddress){
    //let poolContract = await uniswap.getPoolContractByAddress(poolAddress);
    for(let i =0; i<100; i++){
        let res = await uniswap.swap(poolAddress, wallet, true,100000000000n);
    }
}

async function sell_eth(poolAddress){
    //let poolContract = await uniswap.getPoolContractByAddress(poolAddress);
    for(let i =0; i<100; i++){
        let res = await uniswap.swap(poolAddress, wallet, false, 52000000000000000000n);
    }
}

async function go(){
    provider.on('block', on_block_number);

    const blockNumber = await provider.getBlockNumber();
    curBlock = await provider.getBlock(blockNumber);
    console.log(blockNumber);
    console.log(`Bot address: ${wallet.address}`);
    let balance = await uniswap.balanceOf(net.WETH, wallet.address);
    console.log(balance);

    let poolInfo = await uniswap.getPoolInfo("0xcF8beF5387B147E52f8ec23BbebDc4029E412e86");
    console.log(poolInfo)

    //await uniswap.approve(net.routerAddress, net.WETH, 100000000000000000000000000n, wallet);
    //await uniswap.approve(net.routerAddress, net.USDC, 100000000000000000000000000n, wallet);

    //await buy_eth("0xcF8beF5387B147E52f8ec23BbebDc4029E412e86")
    await sell_eth("0xcF8beF5387B147E52f8ec23BbebDc4029E412e86");

    poolPrices = await uniswap.getPrices();
    //test()
    startGeth();

}

go();