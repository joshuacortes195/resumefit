// the facts the terms and privacy pages are built on, kept in one place so a change is one line

// who runs the app
export const OPERATOR = "Joshua Cortes";

// where people write about privacy, the terms or a security problem. change this one line when the address is ready
export const CONTACT_EMAIL = "[contact email to be added]";

// true once a real address is in, so the pages can make it a link
export const CONTACT_IS_EMAIL = /^[^\s@\[\]]+@[^\s@]+\.[^\s@]+$/.test(CONTACT_EMAIL);

// the date shown at the top of both pages. move it whenever either page changes
export const LEGAL_UPDATED = "November 22, 2026";

// whose laws the terms are read under
export const GOVERNING_LAW = "the State of California";

// the youngest a person can be to make an account
export const MINIMUM_AGE = 16;
