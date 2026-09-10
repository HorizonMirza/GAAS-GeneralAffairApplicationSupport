"use client";

import { useState } from "react";
import { ImageIcon, XIcon } from "lucide-react";

interface Props {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Drag-and-drop multi-file picker for Foto Kerusakan (wajib minimal 1, maksimal `maxFiles`) -
// reuses the same .file-dropzone look InvoiceUploadModal already established for single-file
// drag-and-drop, extended with a file list (thumbnail + remove) since here more than one file can
// be attached at once.
export default function PhotoDropUploader({ id, files, onChange, maxFiles = 5, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

  function addFiles(newFiles: FileList | File[]) {
    const incoming = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...incoming].slice(0, maxFiles));
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  const atLimit = files.length >= maxFiles;

  return (
    <div className="photo-drop-uploader">
      <div
        className={`file-dropzone${dragging ? " file-dropzone-dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !atLimit) setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled && !atLimit) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled || atLimit) return;
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
      >
        <ImageIcon width={30} height={30} />
        <div className="file-dropzone-text">
          {atLimit ? (
            <>Sudah {maxFiles} foto (maksimal)</>
          ) : (
            <>Tarik foto ke sini atau <span className="file-dropzone-link">pilih foto</span></>
          )}
        </div>
        {!disabled && !atLimit && (
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="file-dropzone-input"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        )}
      </div>
      <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 6 }}>
        Minimal 1, maksimal {maxFiles} foto &middot; JPG/PNG
      </div>

      {files.length > 0 && (
        <div className="photo-drop-list">
          {files.map((file, index) => (
            <div className="photo-drop-item" key={`${file.name}-${file.lastModified}-${index}`}>
              <div className="photo-drop-item-thumb">
                <img src={URL.createObjectURL(file)} alt={file.name} />
              </div>
              <div className="photo-drop-item-info">
                <span className="photo-drop-item-name">{file.name}</span>
                <span className="photo-drop-item-size">{formatBytes(file.size)}</span>
              </div>
              {!disabled && (
                <button type="button" className="photo-drop-item-remove" aria-label="Hapus foto" onClick={() => removeFile(index)}>
                  <XIcon width={14} height={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
