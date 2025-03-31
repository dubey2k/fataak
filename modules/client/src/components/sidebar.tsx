import { Info, HelpCircle, Settings, X } from "lucide-react";
import "./sidebar.css";
import { FileUploadArea } from "./file-upload-area";
import { HistoryLog } from "./history-log";
import { TextShareArea } from "./text-share-area";
import { Device } from "./device-playground";
import { Events } from "../utils/Events";

type SidebarProps = {
  selectedDevice: Device | null;
};

export function Sidebar({ selectedDevice }: SidebarProps) {
  const handleUpload = async (file: File) => {
    if (selectedDevice !== null) {
      Events.fire("files-selected", { to: selectedDevice.id, files: [file] });
    }
  };

  const handleTextSend = async (text: string) => {
    if (selectedDevice !== null) {
      Events.fire("send-text", { to: selectedDevice.id, text: text });
    }
  };

  const handleDisconnect = () => {
    if (selectedDevice !== null) {
      Events.fire("peer-disconnected", {});
      Events.fire("peer-declined", {});
    }
  };

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">{selectedDevice?.name}</h2>
      {selectedDevice ? (
        <>
          <div className="device-connection">
            <span>Connected to Device</span>
            <button className="disconnect-button" onClick={handleDisconnect}>
              <X />
            </button>
          </div>
          <nav className="sidebar-content">
            <FileUploadArea onUpload={handleUpload} />
            <TextShareArea onTextSend={handleTextSend} />
            <HistoryLog />
          </nav>
        </>
      ) : (
        <nav className="sidebar-content">
          <a href="#" className="sidebar-link">
            <Info />
            How it works
          </a>
          <a href="#" className="sidebar-link">
            <HelpCircle />
            FAQ
          </a>
        </nav>
      )}
      <button className="sidebar-link settings-button">
        <Settings />
        Settings
      </button>
    </aside>
  );
}
