import { Laptop, Smartphone, Tablet } from "lucide-react";
import "./connected-devices.css";

const deviceIcons = {
  laptop: Laptop,
  smartphone: Smartphone,
  tablet: Tablet,
};

type ConnectedDevicesProps = {
  devices: string[];
};

export function ConnectedDevices({ devices }: ConnectedDevicesProps) {
  return (
    <section className="connected-devices">
      <h2 className="connected-devices-title">Connected Devices</h2>
      <div className="device-grid">
        {devices.map((device, index) => {
          const Icon =
            deviceIcons[
              index % 3 === 0
                ? "laptop"
                : index % 3 === 1
                ? "smartphone"
                : "tablet"
            ];
          return (
            <button key={device} className="device-button">
              <Icon className="device-icon" />
              <span className="device-name">{`Device ${index + 1}`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
