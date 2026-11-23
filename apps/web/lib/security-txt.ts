// the standard file security researchers look for (rfc 9116): where to report a problem and the rules for doing it.
// the expiry has to be moved forward before 2027-11-22, or the file tells people it is out of date
export const SECURITY_TXT = [
  "Contact: https://github.com/joshuacortes195/resumefit/security/advisories/new",
  "Expires: 2027-11-22T00:00:00.000Z",
  "Policy: https://github.com/joshuacortes195/resumefit/blob/main/SECURITY.md",
  "Preferred-Languages: en",
  "Canonical: https://resumefit-three.vercel.app/.well-known/security.txt",
  "",
].join("\n");
