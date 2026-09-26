// Matches contracts/src/OpenCashDelegate.sol. One implementation, delegated
// onto each user's own EOA via EIP-7702 — `address` below is always the
// user's account, never a separate per-user contract.
export const callTupleComponents = [
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "data", type: "bytes" },
] as const;

export const openCashDelegateAbi = [
  {
    type: "function",
    name: "nonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "sessionDigest",
    stateMutability: "view",
    inputs: [{ name: "calls", type: "tuple[]", components: callTupleComponents }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "executeWithSession",
    stateMutability: "nonpayable",
    inputs: [
      { name: "calls", type: "tuple[]", components: callTupleComponents },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sessions",
    stateMutability: "view",
    inputs: [{ name: "key", type: "address" }],
    outputs: [
      { name: "expiry", type: "uint64" },
      { name: "revoked", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "authorizeSession",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "expiry", type: "uint64" },
      { name: "targets", type: "address[]" },
      { name: "selectors", type: "bytes4[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeSession",
    stateMutability: "nonpayable",
    inputs: [{ name: "key", type: "address" }],
    outputs: [],
  },
] as const;

export type DelegateCall = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};
