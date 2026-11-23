"use client";

import { useEffect, useRef } from "react";

// the bits of cloudflare's turnstile script we use
type TurnstileApi = { render(box: HTMLElement, options: Record<string, unknown>): string; reset(id: string): void; remove(id: string): void };

// cloudflare's script, in the mode where we say when and where the check is drawn
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// the "are you a person" check on the sign in form. it puts its answer in a hidden box named captcha inside the form.
// every answer works once, so the check starts over whenever retry changes, after each try
export function Turnstile({ siteKey, nonce, retry }: { siteKey: string; nonce: string; retry: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  // loads the script once, with this page's code so the content policy lets it run, then draws the check
  useEffect(() => {
    let gone = false;
    const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    const draw = () => {
      const turnstile = api();
      if (gone || !box.current || !turnstile || widget.current) return;
      widget.current = turnstile.render(box.current, { sitekey: siteKey, "response-field-name": "captcha", appearance: "interaction-only" });
    };
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (api()) draw();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT;
        script.async = true;
        script.nonce = nonce;
        document.head.appendChild(script);
      }
      script.addEventListener("load", draw);
    }
    // takes the check away when the form goes, like after the link is sent
    return () => {
      gone = true;
      script?.removeEventListener("load", draw);
      if (widget.current) api()?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, nonce]);

  // a fresh check after every try, since the last answer has been used up
  useEffect(() => {
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (widget.current && turnstile) turnstile.reset(widget.current);
  }, [retry]);

  return <div ref={box} />;
}
