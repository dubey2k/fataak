import { useState } from "react";
import "./Home.css";
import { Sidebar } from "../../components/sidebar";
import { Device, DevicePlayground } from "../../components/device-playground";
import { StatusBar } from "../../components/status-bar";
import { getPeersManager } from "../../utils/Network";

export default function Home() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  return (
    <div className="app">
      <Sidebar selectedDevice={selectedDevice} />
      <div className="main-content">
        <h1 className="app-title">Fataak</h1>
        <DevicePlayground
          onDeviceSelect={setSelectedDevice}
          selectedDevice={selectedDevice}
        />
        <StatusBar
          connectedDevice={selectedDevice ? selectedDevice.name : null}
        />
      </div>
    </div>
  );
}

getPeersManager();
