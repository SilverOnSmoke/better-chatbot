"use client";

import { useRef } from "react";
import { Button } from "ui/button";
import { Paperclip, X, Loader2 } from "lucide-react";
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload";
import { cn } from "lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

type FileUploadComponentProps = {
  onFilesUploaded: (files: UploadedFile[]) => void;
  uploading?: boolean;
};

export function FileUploadComponent({
  onFilesUploaded,
  uploading,
}: FileUploadComponentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles } = useFileUpload();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const uploadedFiles = await uploadFiles(files);
    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleButtonClick}
            disabled={uploading}
            variant="ghost"
            size="sm"
            className="hover:bg-input! rounded-full p-2!"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Upload images</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

type FilePreviewProps = {
  files: UploadedFile[];
  onRemove: (index: number) => void;
  className?: string;
};

export function FilePreview({ files, onRemove, className }: FilePreviewProps) {
  if (files.length === 0) return null;

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    return "📄";
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {files.map((file, index) => (
        <div
          key={`${file.url}-${index}`}
          className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2"
        >
          <span className="text-base">{getFileIcon(file.type)}</span>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {file.type.split("/")[1].toUpperCase()}
            </span>
            {file.size && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
            )}
          </div>
          <Button
            onClick={() => onRemove(index)}
            variant="ghost"
            size="sm"
            className="size-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
