import { requireTrader } from "./state";

const siteUrl = "https://monad.opencash.in";
const postText = "I'm trading on OpenCash. Join me:";

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

async function renderCard(): Promise<Blob> {
  const trader = requireTrader();
  const name = document.querySelector<HTMLElement>("[data-account-name]")?.textContent?.trim() || "Trader";
  const avatar = document.querySelector<HTMLImageElement>("[data-account-avatar]");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d")!;

  context.fillStyle = "#0b0f0e";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, 0, 1350);
  gradient.addColorStop(0, "#7b73f0");
  gradient.addColorStop(1, "#383072");
  roundedRect(context, 60, 60, 960, 1230, 64);
  context.fillStyle = gradient;
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.16)";
  roundedRect(context, 110, 110, 860, 200, 40);
  context.fill();
  context.fillStyle = "#10102a";
  context.font = "600 72px 'DM Sans', system-ui, sans-serif";
  context.textBaseline = "alphabetic";
  context.fillText(name.length > 22 ? `${name.slice(0, 21)}…` : name, 150, 220);
  context.font = "500 34px 'DM Sans', system-ui, sans-serif";
  context.fillStyle = "rgba(16,16,42,0.7)";
  context.fillText("Trader on OpenCash", 150, 275);
  context.textAlign = "right";
  context.font = "600 28px 'DM Sans', system-ui, sans-serif";
  context.fillText("OPENCASH", 930, 160);
  context.textAlign = "left";

  context.save();
  context.beginPath();
  context.arc(540, 660, 230, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#6c63e4";
  context.fillRect(300, 420, 480, 480);
  if (avatar && avatar.complete && avatar.naturalWidth > 0) context.drawImage(avatar, 310, 430, 460, 460);
  context.restore();
  context.strokeStyle = "rgba(255,255,255,0.4)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(540, 660, 230, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.16)";
  roundedRect(context, 110, 1040, 860, 190, 40);
  context.fill();
  context.fillStyle = "rgba(16,16,42,0.65)";
  context.font = "500 26px 'DM Sans', system-ui, sans-serif";
  context.fillText("ADDRESS", 150, 1100);
  context.fillText("NETWORK", 700, 1100);
  context.fillStyle = "#10102a";
  context.font = "600 44px 'DM Sans', system-ui, sans-serif";
  context.fillText(`${trader.address.slice(0, 6)}…${trader.address.slice(-4)}`, 150, 1170);
  context.fillText("Monad", 700, 1170);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the image"))), "image/png"));
}

export function initShareCard() {
  const button = document.querySelector<HTMLButtonElement>("[data-share-card]");
  const status = document.querySelector<HTMLElement>("[data-share-status]");
  if (!button || !status) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "";
    try {
      const blob = await renderCard();
      const file = new File([blob], "opencash-card.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${postText} ${siteUrl}` });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "opencash-card.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(siteUrl)}`, "_blank", "noopener");
      status.textContent = "Your card image was saved. Attach it to the post that just opened.";
    } catch (error) {
      if ((error as Error).name !== "AbortError") status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      button.disabled = false;
    }
  });
}
