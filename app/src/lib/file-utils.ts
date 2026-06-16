export const TEXTUAL_EXTENSIONS = new Set([
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
    // eslint-disable-next-line no-fallthrough
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
    case "axml":
    case "xsd":
    case "dtd":
    case "config":
    case "csproj":
    case "vbproj":
    case "plist":
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

export const getParentPrefix = (currentPrefix: string) => {
  if (!currentPrefix) return "";
  const parts = currentPrefix.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 0 ? `${parts.join("/")}/` : "";
};

/** Validate an S3 object key/path. Returns an error message, or null if valid. */
export const validateObjectKey = (key: string): string | null => {
  if (!key.trim()) return "Key cannot be empty";
  for (const part of key.split("/")) {
    if (part === "." || part === "..") {
      return "Folder names cannot be '.' or '..'";
    }
  }
  return null;
};
