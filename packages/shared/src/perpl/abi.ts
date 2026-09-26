export const exchangeAbi = [
  {
    "type": "function",
    "name": "createAccount",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "accountId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositCollateral",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawCollateral",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "execOrders",
    "inputs": [
      {
        "name": "orderDescs",
        "type": "tuple[]",
        "internalType": "struct OrderDesc[]",
        "components": [
          {
            "name": "orderDescId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "perpId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "orderType",
            "type": "uint8",
            "internalType": "enum OrderDescEnum"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "pricePNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lotLNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "expiryBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "postOnly",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "fillOrKill",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "immediateOrCancel",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "maxMatches",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "leverageHdths",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastExecutionBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "amountCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxNegPnlCollatBPS",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "revertOnFail",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [
      {
        "name": "signatures",
        "type": "tuple[]",
        "internalType": "struct OrderSignature[]",
        "components": [
          {
            "name": "perpId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "orderId",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAccountByAddr",
    "inputs": [
      {
        "name": "accountAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "accountInfo",
        "type": "tuple",
        "internalType": "struct AccountInfo",
        "components": [
          {
            "name": "accountId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "balanceCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lockedBalanceCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "frozen",
            "type": "uint8",
            "internalType": "enum FreezeStatusEnum"
          },
          {
            "name": "accountAddr",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "positions",
            "type": "tuple",
            "internalType": "struct PositionBitMap",
            "components": [
              {
                "name": "bank1",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "bank2",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "bank3",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "bank4",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPosition",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "positionInfo",
        "type": "tuple",
        "internalType": "struct PositionInfo",
        "components": [
          {
            "name": "accountId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "nextNodeId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "prevNodeId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "positionType",
            "type": "uint8",
            "internalType": "enum PositionEnum"
          },
          {
            "name": "depositCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "pricePNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lotLNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "entryBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "pnlCNS",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "deltaPnlCNS",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "premiumPnlCNS",
            "type": "int256",
            "internalType": "int256"
          }
        ]
      },
      {
        "name": "markPricePNS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "markPriceValid",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPerpetualInfoV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "perpetualInfo",
        "type": "tuple",
        "internalType": "struct PerpetualInfoV2",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "priceDecimals",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lotDecimals",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "linkFeedId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "priceTolPer100K",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "marginTol",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "marginTolDecimals",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "refPriceMaxAgeSec",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "positionBalanceCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "insuranceBalanceCNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "markPNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "markTimestamp",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastPNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "lastTimestamp",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "oraclePNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "oracleTimestampSec",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "longOpenInterestLNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "shortOpenInterestLNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fundingStartBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fundingRatePct100k",
            "type": "int16",
            "internalType": "int16"
          },
          {
            "name": "absFundingClampPctPer100K",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum PerpStatusEnum"
          },
          {
            "name": "basePricePNS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxBidPriceONS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minBidPriceONS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxAskPriceONS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minAskPriceONS",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "numOrders",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "ignOracle",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "fundingSumScalingExp",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarginFractions",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "perpInitMarginFracHdths",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "perpMaintMarginFracHdths",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "dynamicInitMarginFracHdths",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "oiMaxLNS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "unityDescentThreshHdths",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "overColDescentThreshHdths",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTakerFee",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMakerFee",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowOrderForwarding",
    "inputs": [
      {
        "name": "allow",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getPerpetualExistsBitmap",
    "inputs": [],
    "outputs": [
      {
        "name": "bitmap",
        "type": "uint256[4]",
        "internalType": "uint256[4]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMinAccountOpenCNS",
    "inputs": [],
    "outputs": [
      {
        "name": "minAccountOpenCNS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isHalted",
    "inputs": [],
    "outputs": [
      {
        "name": "halted",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  }
] as const;
