import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import "./file-upload-area.css";
import { Upload } from "lucide-react";

type FileUploadAreaProps = {
  onUpload: (file: File) => void;
};

export function FileUploadArea({ onUpload }: FileUploadAreaProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onUpload(file);
      }
    };
    input.click();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <section className="file-upload-area">
      <h2>Share Files</h2>
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? "active" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="upload-icon" />
        <p>Drag & drop a file here, or click to select</p>
        <p className="or">or</p>
        <button
          onClick={() => handleFileSelect()}
          className="select-files-button"
        >
          Select Files
        </button>
      </div>
      <p className="supported-files">Supported: Images, PDFs, Documents</p>
    </section>
  );
}
