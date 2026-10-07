export const perplEventsAbi = [
  {
    "type": "event",
    "name": "AccountCreated",
    "inputs": [
      {
        "type": "address",
        "name": "account",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "id",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "CollateralDeposit",
    "inputs": [
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "CollateralWithdrawal",
    "inputs": [
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionOpened",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "leverageHdths",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "depositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "pnlCollateralizedCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "lotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "insFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "protFeeCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionOpenedV2",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "leverageHdths",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "depositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "pnlCollateralizedCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "lotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "insFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "protFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "priceResiduePNSQ16",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionIncreased",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "leverageHdths",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "pnlCollateralizedCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "premiumPnlSettledCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "maxNegPnlCollatBPS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "insFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "protFeeCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionIncreasedV2",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "leverageHdths",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "pnlCollateralizedCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "premiumPnlSettledCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "maxNegPnlCollatBPS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "insFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "protFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "priceResiduePNSQ16",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionDecreased",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionClosed",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionInverted",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "leverageHdths",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "pnlCollateralizedCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "insFeeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "protFeeCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionLiquidated",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "posAccountId",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "markPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "liqPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "liqLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "posLotLNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "posAmountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "posDepositCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "accAmountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accBalanceCNS",
        "indexed": false
      },
      {
        "type": "bool",
        "name": "onOrderBook",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionDeleveraged",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "bool",
        "name": "forceClose",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "entryPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "markPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "deleveragePricePNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "PositionDeleveragedV2",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "bool",
        "name": "forceClose",
        "indexed": false
      },
      {
        "type": "uint8",
        "name": "positionType",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "entryPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "markPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "deleveragePricePNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "deltaPnlCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "fundingCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endDepositCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "startLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "endLotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "priceResiduePNSQ16",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "MakerOrderFilledV2",
    "inputs": [
      {
        "type": "uint256",
        "name": "perpId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "accountId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "orderId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "lotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "feeCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "lockedBalanceCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "builderId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "builderFeeCNS",
        "indexed": false
      }
    ]
  },
  {
    "type": "event",
    "name": "TakerOrderFilledV2",
    "inputs": [
      {
        "type": "uint256",
        "name": "entryPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "collatPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "pnlPricePNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "lotLNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "feeCNS",
        "indexed": false
      },
      {
        "type": "int256",
        "name": "amountCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "balanceCNS",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "builderId",
        "indexed": false
      },
      {
        "type": "uint256",
        "name": "builderFeeCNS",
        "indexed": false
      }
    ]
  }
] as const;

export const accountByIdAbi = [{
  "type": "function",
  "name": "getAccountById",
  "stateMutability": "view",
  "inputs": [
    {
      "type": "uint256",
      "name": "accountId"
    }
  ],
  "outputs": [
    {
      "type": "tuple",
      "name": "accountInfo",
      "components": [
        {
          "type": "uint256",
          "name": "accountId"
        },
        {
          "type": "uint256",
          "name": "balanceCNS"
        },
        {
          "type": "uint256",
          "name": "lockedBalanceCNS"
        },
        {
          "type": "uint8",
          "name": "frozen"
        },
        {
          "type": "address",
          "name": "accountAddr"
        },
        {
          "type": "tuple",
          "name": "positions",
          "components": [
            {
              "type": "uint256",
              "name": "bank1"
            },
            {
              "type": "uint256",
              "name": "bank2"
            },
            {
              "type": "uint256",
              "name": "bank3"
            },
            {
              "type": "uint256",
              "name": "bank4"
            }
          ]
        }
      ]
    }
  ]
}] as const;
