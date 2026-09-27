import {
  approveRequest,
  binById,
  binEntrySwaps,
  hoodMainnet,
  loadStockTokens,
  openCashDelegateAbi,
  sizeBin,
  swapRouter02Abi,
  tokensBySymbol,
  toScaled,
  type DelegateCall,
} from "shared";
import { encodeFunctionData } from "viem";
import { agentAccount, agentWalletClient, publicClient } from "../chain.js";
import { getMandate } from "./mandates.js";
import { getProposal } from "./proposals.js";
import { recordReceipt } from "./receipts.js";
import type { Receipt } from "./types.js";

export async function executeProposal(proposalId: string): Promise<Receipt> {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error(`Unknown proposal ${proposalId}`);

  const mandate = await getMandate(proposal.mandateId);
  if (!mandate) throw new Error(`Unknown mandate ${proposal.mandateId}`);

  if (proposal.usdgAmount <= 0) {
    return recordReceipt({
      mandateId: mandate.id,
      proposalId: proposal.id,
      status: "failed",
      detail: "Proposal allocates $0 — nothing to execute",
    });
  }

  const bin = binById(mandate.binId);
  if (!bin) throw new Error(`Unknown bin ${mandate.binId}`);

  const tokens = tokensBySymbol(await loadStockTokens());
  const { sized, issues } = await sizeBin(publicClient, bin, proposal.usdgAmount, tokens);

  if (sized.legs.length === 0) {
    return recordReceipt({
      mandateId: mandate.id,
      proposalId: proposal.id,
      status: "failed",
      detail: `No leg could be sized: ${issues.map((issue) => issue.detail).join("; ")}`,
    });
  }

  const total = toScaled(sized.usdgIn, hoodMainnet.usdgDecimals);
  const swaps = binEntrySwaps(sized, mandate.owner);

  const calls: DelegateCall[] = [
    {
      to: hoodMainnet.usdg,
      value: 0n,
      data: encodeFunctionData(approveRequest(hoodMainnet.usdg, hoodMainnet.swapRouter02, total)),
    },
    {
      to: hoodMainnet.swapRouter02,
      value: 0n,
      data: encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: "multicall",
        args: [swaps.map((swap) => encodeFunctionData(swap))],
      }),
    },
  ];

  try {
    const digest = await publicClient.readContract({
      address: mandate.owner,
      abi: openCashDelegateAbi,
      functionName: "sessionDigest",
      args: [calls],
    });

    const account = agentAccount();
    const signature = await account.sign({ hash: digest });

    const wallet = agentWalletClient();
    const txHash = await wallet.writeContract({
      address: mandate.owner,
      abi: openCashDelegateAbi,
      functionName: "executeWithSession",
      args: [calls, signature],
      chain: wallet.chain,
      account,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return recordReceipt({
      mandateId: mandate.id,
      proposalId: proposal.id,
      status: "executed",
      detail: `Swapped $${sized.usdgIn.toFixed(2)} into ${bin.name} across ${sized.legs.length} leg(s)`,
      usdgAmount: sized.usdgIn,
      txHash,
    });
  } catch (error) {
    return recordReceipt({
      mandateId: mandate.id,
      proposalId: proposal.id,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
