import Editor from "@monaco-editor/react";
import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FileViewerProps {
	content: string;
	language?: string;
	onSave?: (newContent: string) => void;
}

export function FileViewer({ content, language = "plaintext", onSave }: FileViewerProps) {
	const [value, setValue] = useState(content);
	const isEditable = !!onSave;

	return (
		<div className="h-full w-full flex flex-col gap-2">
			{isEditable && (
				<div className="flex justify-end">
					<Button size="sm" onClick={() => onSave(value)}>
						<Save className="h-4 w-4 mr-2" />
						Save
					</Button>
				</div>
			)}
			<div className="flex-1 border rounded-md overflow-hidden">
				<Editor
					height="100%"
					defaultLanguage={language}
					value={value}
					onChange={(val) => setValue(val || "")}
					options={{
						readOnly: !isEditable,
						minimap: { enabled: false },
						scrollBeyondLastLine: false,
					}}
				/>
			</div>
		</div>
	);
}
