"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plug, Unplug } from "lucide-react";
import { connectExtension, disconnectExtension } from "@/app/actions/profile";
import { LocalTime } from "@/components/local-time";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { connectionCode, rememberExtensionId, savedExtensionId, tellExtension } from "@/lib/extension-client";

type ConnectProps = {
  connected: boolean;
  // when the extension last talked to us
  lastUsed: string | null;
};

// connects the extension to this account: directly when we can reach it, with a code to paste when we cannot
export function ExtensionConnect({ connected, lastUsed }: ConnectProps) {
  const [code, setCode] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState(() => (typeof window === "undefined" ? "" : savedExtensionId()));
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // makes a fresh key, then tries to hand it straight to the extension
  function connect() {
    setStatus(null);
    startTransition(async () => {
      const { token } = await connectExtension();
      if (extensionId.trim()) rememberExtensionId(extensionId);
      const delivered = await tellExtension({ type: "resumefit-connect", token, apiBase: location.origin }, extensionId.trim() || undefined);
      if (delivered) {
        setCode(null);
        setStatus("Sent. Open the extension's side panel and press Connect there to finish.");
      } else {
        // could not reach it, so show the code to paste instead
        setCode(connectionCode(token));
        setStatus(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm">
        {connected ? <Check className="size-4 text-success" aria-hidden /> : <Unplug className="size-4 text-muted" aria-hidden />}
        {connected ? (
          <span>
            The extension is connected
            {lastUsed && (
              <>
                , last used <LocalTime value={lastUsed} style="time" />
              </>
            )}
            .
          </span>
        ) : (
          "The extension is not connected yet."
        )}
      </p>

      <label className="block max-w-md text-sm font-medium">
        Extension ID <span className="font-normal text-muted">(optional)</span>
        <input value={extensionId} onChange={(event) => setExtensionId(event.target.value)} placeholder="32 letters, shown on chrome://extensions" className={`${INPUT} mt-1 font-normal`} />
        <span className="mt-1 block text-xs font-normal text-muted">With the ID we can connect in one click. Without it you get a code to paste into the extension, which works just as well.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={connect} className={PRIMARY_BUTTON}>
          <Plug className="size-4" aria-hidden />
          {pending ? "Connecting..." : connected ? "Connect again" : "Connect extension"}
        </button>
        {connected && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await disconnectExtension();
                setCode(null);
                setStatus("Disconnected. The extension can no longer reach your account.");
              })
            }
            className={SECONDARY_BUTTON}
          >
            Disconnect
          </button>
        )}
      </div>
      {status && (
        <p role="status" className="text-sm text-success">
          {status}
        </p>
      )}

      {/* the fallback: a code to paste into the side panel */}
      {code && (
        <div className="max-w-xl space-y-2 rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold">Paste this code into the extension</p>
          <p className="text-sm text-muted">Click the ResumeFit icon in Chrome&apos;s toolbar to open its side panel, paste the code and press Connect. The code is shown once and works like a password, so do not share it.</p>
          <textarea readOnly aria-label="Connection code" value={code} rows={3} onFocus={(event) => event.target.select()} className={`${INPUT} bg-surface font-mono text-xs`} />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className={`${SECONDARY_BUTTON} px-3 py-1.5`}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      )}
    </div>
  );
}
