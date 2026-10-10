import { describe, expect, it } from "vitest";
import { checkPublicUrl, isPrivateAddress, readJobPage } from "@/lib/job-import";

describe("reading a job from a link", () => {
  it("refuses addresses inside a private network", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(address), address).toBe(true);
    for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(address), address).toBe(false);
  });

  it("only takes plain https links to a real site", async () => {
    for (const link of ["http://example.com/job", "https://127.0.0.1/job", "https://localhost/job", "https://user:pass@example.com/", "https://example.com:8443/", "file:///etc/passwd", "not a link", "https://[::1]/"]) await expect(checkPublicUrl(link), link).rejects.toThrow();
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
});
