import { Upload } from "lucide-react";
import "./file-upload-area.css";
import React from "react";

export const FileUploadArea: React.FC<{
  onUpload: (file: File) => Promise<void>;
}> = ({ onUpload }) => {
  const handleFile = async () => {
    //
  };

  return (
    <section className="file-upload-area">
      <h2>Share Files</h2>
      <div className="upload-zone">
        <Upload className="upload-icon" />
        <p>Drag and drop files here</p>
        <p className="or">or</p>
        <button onClick={() => handleFile} className="select-files-button">
          Select Files
        </button>
      </div>
      <p className="supported-files">Supported: Images, PDFs, Documents</p>
    </section>
  );
};
