import { Code2, Eye, Save } from "lucide-react";
import { useState } from "react";
import { FileViewer } from "@/components/FileViewer";
import { RenderedPreview } from "@/components/RenderedPreview";
import { Button } from "@/components/ui/button";
import type { DualPreviewKind } from "@/lib/file-utils";
import { getLanguageFromFilename } from "@/lib/file-utils";

interface DualPreviewProps {
  fileKey: string;
  kind: DualPreviewKind;
  content: string;
  onSave?: (newContent: string) => void;
}

type Mode = "rendered" | "code";

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const button = (value: Mode, label: string, Icon: typeof Eye) => (
    <Button
      variant={mode === value ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <div className="inline-flex gap-1 rounded-md border p-0.5">
      {button("rendered", "Rendered", Eye)}
      {button("code", "Code", Code2)}
    </div>
  );
}

export function DualPreview({ fileKey, kind, content, onSave }: DualPreviewProps) {
  const [mode, setMode] = useState<Mode>("rendered");
  const [value, setValue] = useState(content);

  if (mode === "code") {
    return (
      <FileViewer
        content={value}
        language={getLanguageFromFilename(fileKey)}
        onSave={onSave}
        onChange={setValue}
        toolbarLeading={<ModeToggle mode={mode} onChange={setMode} />}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <div className="mr-auto">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        {onSave && (
          <Button size="sm" onClick={() => onSave(value)}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
        <RenderedPreview kind={kind} content={value} title={fileKey} />
      </div>
    </div>
  );
}
