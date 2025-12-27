export const VIEWABLE_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "js",
  "ts",
  "tsx",
  "jsx",
  "html",
  "css",
  "scss",
  "less",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "rb",
  "php",
  "sh",
  "bash",
  "zsh",
  "yaml",
  "yml",
  "xml",
  "sql",
  "ini",
  "conf",
  "properties",
  "log",
  "csv",
  "ps1",
  "htm",
  "sass",
  "rst",
  "xaml",
  "cs",
]);

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"]);

export const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "md":
      return "markdown";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "json":
      return "json";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "scss":
    case "sass":
    case "less":
      return "scss";
    case "sql":
      return "sql";
    case "xml":
    case "xaml":
      return "xml";
    case "cs":
      return "csharp";
    case "ps1":
      return "powershell";
    case "rst":
      return "restructuredtext";
    default:
      return "plaintext";
  }
};
