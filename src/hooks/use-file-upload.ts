import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface UploadedFile {
  url: string;
  type: string;
  size?: number;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      try {
        setUploading(true);

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          toast.error("File size must be less than 10MB");
          return null;
        }

        // Validate file type (images only)
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/svg+xml",
        ];

        if (!allowedTypes.includes(file.type)) {
          toast.error("Only image files are supported");
          return null;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const data = await response.json();

        return {
          url: data.url,
          type: file.type,
          size: file.size,
        };
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(error instanceof Error ? error.message : "Upload failed");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const uploadFiles = useCallback(
    async (files: FileList): Promise<UploadedFile[]> => {
      const fileArray = Array.from(files);
      const uploadPromises = fileArray.map(uploadFile);
      const results = await Promise.all(uploadPromises);
      return results.filter(
        (result): result is UploadedFile => result !== null,
      );
    },
    [uploadFile],
  );

  const readFromClipboard = useCallback(async (): Promise<UploadedFile[]> => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File(
              [blob],
              `clipboard-image.${type.split("/")[1]}`,
              {
                type,
              },
            );
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length === 0) {
        return [];
      }

      const uploadPromises = imageFiles.map(uploadFile);
      const results = await Promise.all(uploadPromises);
      return results.filter(
        (result): result is UploadedFile => result !== null,
      );
    } catch (error) {
      console.error("Clipboard read error:", error);
      return [];
    }
  }, [uploadFile]);

  return {
    uploading,
    uploadFile,
    uploadFiles,
    readFromClipboard,
  };
}
