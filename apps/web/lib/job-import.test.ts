import { describe, expect, it } from "vitest";
import { checkPublicUrl, isPrivateAddress, publicLookup, readJobPage } from "@/lib/job-import";

describe("reading a job from a link", () => {
  it("refuses addresses inside a private network", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::127.0.0.1", "::ffff:a00:1", "64:ff9b::a00:1", "2002:a00:1::1", "fec0::1", "198.51.100.7", "203.0.113.7"]) expect(isPrivateAddress(address), address).toBe(true);
    for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "198.51.101.7"]) expect(isPrivateAddress(address), address).toBe(false);
  });

  it("only takes plain https links to a real site", async () => {
    for (const link of ["http://example.com/job", "https://127.0.0.1/job", "https://localhost/job", "https://user:pass@example.com/", "https://example.com:8443/", "file:///etc/passwd", "not a link", "https://[::1]/"]) await expect(checkPublicUrl(link), link).rejects.toThrow();
  });

  it("refuses a private address at the moment of connecting, not only when the link is first checked", async () => {
    // this is the lookup the connection itself uses, so a site cannot pass the check and then point somewhere else
    const error = await new Promise<Error | null>((resolve) => publicLookup("localhost", { all: true }, (problem) => resolve(problem)));
    expect(error?.message).toBe("private address");
  });

  it("reads the posting from a page's structured data", () => {
    const html = `<html><head><title>Ignore me</title><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"JobPosting","title":"Supply Chain Analyst","hiringOrganization":{"@type":"Organization","name":"Harbor Freight Co"},"jobLocation":{"@type":"Place","address":{"addressLocality":"Tucson","addressRegion":"AZ","addressCountry":"US"}},"description":"&lt;p&gt;Plan inventory.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;SQL&lt;/li&gt;&lt;/ul&gt;"}]}</script></head></html>`;
    expect(readJobPage(html)).toEqual({ title: "Supply Chain Analyst", company: "Harbor Freight Co", location: "Tucson, AZ, US", description: "Plan inventory.\n\n• SQL" });
  });

  it("falls back to what the page says when it is shared", () => {
    const html = `<head><meta property="og:title" content="Nurse Manager &amp; Lead"><meta property="og:site_name" content="Mesa Health"><meta name="description" content="Lead a team of twelve."></head>`;
    expect(readJobPage(html)).toEqual({ title: "Nurse Manager & Lead", company: "Mesa Health", location: "", description: "Lead a team of twelve." });
    expect(readJobPage("<p>nothing here</p>")).toBeNull();
  });

  it("falls back to the page title, and skips structured data that is broken or about something else", () => {
    const html = `<html><head><script type="application/ld+json">{not json</script><script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script><TITLE lang="en">Dock Supervisor at Acme</TITLE></head></html>`;
    expect(readJobPage(html)).toEqual({ title: "Dock Supervisor at Acme", company: "", location: "", description: "" });
  });

  it("reads a page built to be slow about as fast as any other", () => {
    const hostile = [
      "<script ".repeat(250_000),
      "<meta ".repeat(300_000),
      "<title>".repeat(250_000),
      `<script type="application/ld+json">{"@type":"JobPosting","title":"T","description":"${"<".repeat(1_500_000)}"}</script>`,
      `<script type="application/ld+json">`.repeat(50_000),
      "<script>".repeat(200_000),
    ];
    for (const html of hostile) {
      const started = Date.now();
      readJobPage(html);
      expect(Date.now() - started, html.slice(0, 40)).toBeLessThan(1500);
    }
  });
});
