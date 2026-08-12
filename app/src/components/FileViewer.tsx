import Editor, { type OnMount } from "@monaco-editor/react";
import { AlignLeft, Minimize2, Save } from "lucide-react";
import type { editor } from "monaco-editor";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
// Registers the languages and hands Monaco to the loader before `<Editor>` mounts.
import "@/lib/monaco-setup";

interface FileViewerProps {
  content: string;
  language?: string;
  onSave?: (newContent: string) => void;
}

const formatXml = (xml: string) => {
  let formatted = "";
  let pad = 0;
  // Naive XML formatter
  const nodes = xml.replace(/>\s*</g, "><").replace(/</g, "~::~<").split("~::~");

  for (const node of nodes) {
    if (!node) continue;

    let indent = 0;
    // Check if it's an opening tag (not self-closing, not instruction) and doesn't contain a closing tag immediately
    if (node.match(/^<\w/) && !node.match(/^<\w[^>]*\/>/) && !node.match(/^<\w[^>]*>.*<\/\w[^>]*>$/)) {
      indent = 1;
    } else if (node.match(/^<\/\w/)) {
      // Closing tag
      if (pad > 0) pad -= 1;
    }

    formatted += `${"  ".repeat(pad) + node}\r\n`;
    if (indent > 0) pad += indent;
  }
  return formatted.trim();
};

const minifyXml = (xml: string) => {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export function FileViewer({ content, language = "plaintext", onSave }: FileViewerProps) {
  const [value, setValue] = useState(content);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const isEditable = !!onSave;

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const updateContent = (newContent: string) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      editorRef.current.pushUndoStop();
      editorRef.current.executeEdits("format", [
        {
          range: model.getFullModelRange(),
          text: newContent,
        },
      ]);
      editorRef.current.pushUndoStop();
    }
  };

  const handleFormat = () => {
    if (!editorRef.current) return;

    if (language === "json") {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    } else if (language === "xml" || language === "html") {
      try {
        const currentVal = editorRef.current.getValue();
        const formatted = formatXml(currentVal);
        updateContent(formatted);
      } catch {
        toast.error("Code formatting failed");
      }
    }
  };

  const handleMinimize = () => {
    if (!editorRef.current) return;
    try {
      const currentVal = editorRef.current.getValue();
      let minified = "";

      if (language === "json") {
        minified = JSON.stringify(JSON.parse(currentVal));
      } else if (language === "xml" || language === "html") {
        minified = minifyXml(currentVal);
      }

      if (minified) updateContent(minified);
    } catch {
      toast.error("Invalid content: Cannot minimize");
    }
  };

  const showTools = ["json", "xml", "html"].includes(language || "");

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        {showTools && isEditable && (
          <>
            <Button variant="outline" size="sm" onClick={handleFormat} title={`Format ${language?.toUpperCase()}`}>
              <AlignLeft className="h-4 w-4 mr-2" />
              Format
            </Button>
            <Button variant="outline" size="sm" onClick={handleMinimize} title={`Minimize ${language?.toUpperCase()}`}>
              <Minimize2 className="h-4 w-4 mr-2" />
              Minimize
            </Button>
          </>
        )}
        {isEditable && (
          <Button size="sm" onClick={() => onSave(value)}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
      </div>
      <div className="flex-1 border rounded-md overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={value}
          onChange={(val) => setValue(val || "")}
          onMount={handleEditorDidMount}
          options={{
            readOnly: !isEditable,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
          }}
        />
      </div>
    </div>
  );
}
