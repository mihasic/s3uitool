import Editor from "@monaco-editor/react";

interface FileViewerProps {
  content: string;
  language?: string;
}

export function FileViewer({ content, language = "plaintext" }: FileViewerProps) {
  return (
    <div className="h-full w-full border rounded-md overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage={language}
        value={content}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
