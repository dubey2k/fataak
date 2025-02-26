import { Wifi } from "lucide-react";
import "./status-bar.css";

type StatusBarProps = {
  connectedDevice: string | null;
};

export function StatusBar({ connectedDevice }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="connection-status">
        <Wifi
          className={`status-wifi-icon ${connectedDevice ? "connected" : ""}`}
        />
        <span>
          {connectedDevice
            ? `Connected to ${connectedDevice}`
            : "Not connected"}
        </span>
      </div>
      <div className="session-id">
        Session ID: <span className="session-id-value">ABC123</span>
      </div>
    </footer>
  );
}
