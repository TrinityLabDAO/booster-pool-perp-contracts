const addresses = {
    mainnet : {
        CHAIN_ID : 1,
        fb_relay : "https://relay.flashbots.net/",
        ethermine_relay : "https://mev-relay.ethermine.org",
        geth_url : 'http://95.216.246.246:8545',
        geth_ws_url : 'ws://95.216.246.246:8546',

        factoryAddress : '0x1f98431c8ad98523631ae4a59f267346ea31f984',
        routerAddress : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        positionManagerAddress : '0xc36442b4a4522e871399cd717abdd847ab11fe88',
        boosterPool : '',
        WETH : "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        USDC : "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        pools : {},
        tokens : {}
    },
    kovan : {
        CHAIN_ID : 42,
        factoryAddress : '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        routerAddress : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        positionManagerAddress : '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        boosterPool : '',
        WETH : "",
        USDC : "",
        pools : {},
        tokens : {}
    },
    ropsten : {
        CHAIN_ID : 3,
        geth_url : '',
        geth_ws_url : '',

        factoryAddress : '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        routerAddress : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        positionManagerAddress : '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        boosterPool : '0x22645785833794ad60C8d4ebE9dee929DcEe2026',
        WETH : "0x07cb5c8c9425cc18dc729ce44230fb0e9608b0dd",
        USDC : "0xc984c4a9ca20ff5fa8e03084f4cb56fa4d8986f1",
        pools : {
            "0xcF8beF5387B147E52f8ec23BbebDc4029E412e86" : {
                "fee": "500",
                "token0": "0x07cb5c8c9425cc18dc729ce44230fb0e9608b0dd",
                "token1": "0xc984c4a9ca20ff5fa8e03084f4cb56fa4d8986f1"
            },
            "0xd764123C51463414BeEee2300557A1e0043B37c4" : {
                "fee": "3000",
                "token0": "0x07cb5c8c9425cc18dc729ce44230fb0e9608b0dd",
                "token1": "0xc984c4a9ca20ff5fa8e03084f4cb56fa4d8986f1"
            },
            "0xbaE38f90d557AB380b96D26f2c705aEEC2b9D764" : {
                "fee": "10000",
                "token0": "0x07cb5c8c9425cc18dc729ce44230fb0e9608b0dd",
                "token1": "0xc984c4a9ca20ff5fa8e03084f4cb56fa4d8986f1"
            }
        },
        tokens : {
            "0x07cb5c8c9425cc18dc729ce44230fb0e9608b0dd": {
                "symbol": "WETH",
                "decimals": "18"
            },
            "0xc984c4a9ca20ff5fa8e03084f4cb56fa4d8986f1": {
                "symbol": "USDC",
                "decimals": "6"
            },
        }
    },
    goerli : {
        CHAIN_ID : 5,
        fb_relay : "https://relay-goerli.flashbots.net/",
        geth_url : "http://95.216.246.246:8505",
        geth_ws_url : "ws://95.216.246.246:8506",

        factoryAddress : '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        routerAddress : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        positionManagerAddress : '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        boosterPool : '',

        WETH : "",
        USDC : "",
        pools : {},
        tokens : {}
    }
};

module.exports = addresses;