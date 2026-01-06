import Editor, { type OnMount } from "@monaco-editor/react";
import { AlignLeft, Minimize2, Save } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FileViewerProps {
  content: string;
  language?: string;
  onSave?: (newContent: string) => void;
}

export function FileViewer({ content, language = "plaintext", onSave }: FileViewerProps) {
  const [value, setValue] = useState(content);
  const editorRef = useRef<any>(null);
  const isEditable = !!onSave;

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;
  };

  const handleFormat = () => {
    if (!editorRef.current) return;
    editorRef.current.getAction("editor.action.formatDocument")?.run();
  };

  const handleMinimize = () => {
    if (!editorRef.current) return;
    try {
      const currentVal = editorRef.current.getValue();
      const minified = JSON.stringify(JSON.parse(currentVal));
      editorRef.current.setValue(minified);
    } catch (e) {
      toast.error("Invalid JSON: Cannot minimize");
    }
  };

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        {language === "json" && isEditable && (
          <>
            <Button variant="outline" size="sm" onClick={handleFormat} title="Format JSON">
              <AlignLeft className="h-4 w-4 mr-2" />
              Format
            </Button>
            <Button variant="outline" size="sm" onClick={handleMinimize} title="Minimize JSON">
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
          }}
        />
      </div>
    </div>
  );
}
