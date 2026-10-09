// asks the server to turn text into a word file or pdf and hands it to the browser to save
export async function downloadExport(input: { text: string; format: "docx" | "pdf"; kind: "resume" | "letter"; name: string }): Promise<string | null> {
  const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    return result.error ?? "The download did not work. Try again.";
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${input.name}.${input.format}`;
  link.click();
  URL.revokeObjectURL(url);
  return null;
}
