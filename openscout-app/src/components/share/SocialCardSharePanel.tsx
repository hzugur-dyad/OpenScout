"use client";

import { useRef, useState } from "react";
import { Copy, DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { toBlob, toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  fileName: string;
  shareText: string;
  children: React.ReactNode;
  frameless?: boolean;
  compactPreview?: boolean;
  hideHeader?: boolean;
  centerActions?: boolean;
  noWrapActions?: boolean;
};

async function nodeToBlob(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, {
    cacheBust: true,
    pixelRatio: 2,
    width: 1080,
    height: 1350,
    style: {
      width: "1080px",
      height: "1350px",
      margin: "0",
      transform: "none",
    },
  });
  if (!blob) throw new Error("Could not generate image blob.");
  return blob;
}

export function SocialCardSharePanel({
  title,
  fileName,
  shareText,
  children,
  frameless = false,
  compactPreview = false,
  hideHeader = false,
  centerActions = false,
  noWrapActions = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | "download" | "copy" | "share">(null);
  const [message, setMessage] = useState<string | null>(null);

  const withCard = async <T,>(fn: (node: HTMLDivElement) => Promise<T>) => {
    if (!cardRef.current) return;
    setMessage(null);
    try {
      await fn(cardRef.current);
    } catch {
      setMessage("Could not generate card image.");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = () => {
    setBusy("download");
    void withCard(async (node) => {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 1350,
        style: {
          width: "1080px",
          height: "1350px",
          margin: "0",
          transform: "none",
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${fileName}.png`;
      link.click();
      setMessage("PNG downloaded.");
    });
  };

  const handleCopyImage = () => {
    setBusy("copy");
    void withCard(async (node) => {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("Clipboard API unavailable");
      }
      const blob = await nodeToBlob(node);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage("Image copied.");
    });
  };

  const handleShare = () => {
    setBusy("share");
    void withCard(async (node) => {
      const blob = await nodeToBlob(node);
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (typeof navigator.share !== "function") {
        throw new Error("Share API unavailable");
      }
      const data: ShareData = { text: shareText, files: [file] };
      if (navigator.canShare && !navigator.canShare(data)) {
        throw new Error("Share with file not supported");
      }
      await navigator.share(data);
      setMessage("Shared.");
    });
  };

  const canCopyImage = typeof ClipboardItem !== "undefined";
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section
      className={
        frameless
          ? "p-0"
          : "rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-card dark:border-white/[0.12] dark:bg-black/25"
      }
    >
      {!hideHeader && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Download as PNG, copy image, or use native share.
            </p>
          </div>
        </div>
      )}

      <div
        className={
          frameless
            ? "px-1"
            : "rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/30"
        }
      >
        <div
          ref={cardRef}
          className={`mx-auto w-full ${compactPreview ? "max-w-[min(340px,78vw)]" : "max-w-[420px]"}`}
        >
          {children}
        </div>
      </div>

      <div className={`mt-4 flex gap-2 ${centerActions ? "justify-center" : ""} ${noWrapActions ? "flex-nowrap" : "flex-wrap"}`}>
        <Button
          variant="primary"
          size="sm"
          icon={DownloadSimple}
          iconPosition="left"
          onClick={handleDownload}
          disabled={busy !== null}
        >
          Download
        </Button>
        {canCopyImage && (
          <Button
            variant="outline"
            size="sm"
            icon={Copy}
            iconPosition="left"
            onClick={handleCopyImage}
            disabled={busy !== null}
          >
            Copy
          </Button>
        )}
        {canNativeShare && (
          <Button
            variant="outline"
            size="sm"
            icon={ShareNetwork}
            iconPosition="left"
            onClick={handleShare}
            disabled={busy !== null}
          >
            Share
          </Button>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{message}</p>}
    </section>
  );
}
