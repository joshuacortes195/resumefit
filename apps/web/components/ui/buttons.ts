// shared looks for buttons and form fields, so every page uses the same ones

// the main action on a page
export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink transition duration-150 ease-out hover:bg-ink-hover active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

// a quieter action next to the main one
export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition duration-150 ease-out hover:bg-primary-soft active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

// a text only action, like a link inside a sentence
export const LINK_BUTTON = "font-semibold text-primary underline-offset-2 transition-colors duration-150 hover:text-primary-hover hover:underline";

// text inputs and dropdowns
export const INPUT = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors duration-150 focus:border-primary";

// cards that hold a section of a page
export const CARD = "rounded-2xl border border-border/70 bg-surface shadow-card";

// added to cards you can act on: they lift a little under the mouse
export const LIFT = "transition-[transform,box-shadow] duration-200 ease-settle hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(28_27_24/0.06),0_12px_28px_rgb(28_27_24/0.08)]";
