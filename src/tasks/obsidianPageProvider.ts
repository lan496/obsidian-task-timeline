import { App } from "obsidian";
import { PageProvider, ResolvedPage } from "./resolveLinkedPages";

export function makeObsidianPageProvider(app: App): PageProvider {
  return {
    resolve(linkText: string, hostPath: string): ResolvedPage | null {
      const file = app.metadataCache.getFirstLinkpathDest(linkText, hostPath);
      if (file === null) {
        return null;
      }
      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      return {
        path: file.path,
        properties: frontmatter !== undefined ? { ...frontmatter } : {},
      };
    },
  };
}
