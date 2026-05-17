import { App } from "obsidian";
import { MarkdownDocument } from "./types";

export async function readMarkdownDocuments(
  app: App
): Promise<MarkdownDocument[]> {
  const files = app.vault.getMarkdownFiles();

  const documents: MarkdownDocument[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    documents.push({
      path: file.path,
      content,
    });
  }

  return documents;
}
