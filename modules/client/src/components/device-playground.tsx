import { useState, useEffect } from "react";
import { Laptop, Smartphone, Tablet, Wifi, Monitor } from "lucide-react";
import "./device-playground.css";
import { PeerInfo } from "../types/PeerInfo";
import { Events, LocalEvents } from "../utils/Events";
import { getPeersManager } from "../utils/Network";

export type Device = {
  id: string;
  name: string;
  type: "laptop" | "smartphone" | "tablet";
  orbit: number;
  angle: number;
  peer: PeerInfo;
};

const deviceIcons = {
  laptop: Laptop,
  smartphone: Smartphone,
  tablet: Tablet,
};

type DevicePlaygroundProps = {
  onDeviceSelect: (deviceId: Device | null) => void;
  selectedDevice: Device | null;
};

export function DevicePlayground({
  onDeviceSelect,
  selectedDevice,
}: DevicePlaygroundProps) {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const cleanupListeners = setEventListeners();

    return () => {
      cleanupListeners();
    };
  }, []);

  const setEventListeners = () => {
    const eventHandlers = [
      { event: "peer-declined", handler: () => {} },
      {
        event: "peer-requested",
        handler: (e: CustomEvent<PeerInfo>) => {
          const ind = devices.findIndex((item) => item.id === e.detail.id);
          if (ind !== -1) {
            if (selectedDevice && selectedDevice.id !== devices[ind].id) {
              Events.fire("peer-disconnected", {});
            }
            onDeviceSelect(devices[ind]);
          }
        },
      },
      {
        event: "peer-disconnected",
        handler: () => {
          onDeviceSelect(null);
        },
      },
      {
        event: "peer-joined",
        handler: (e: CustomEvent<PeerInfo>) => addDevices([e.detail]),
      },
      {
        event: "peer-left",
        handler: (e: CustomEvent<PeerInfo>) => {
          const updatedDevices = devices.filter(
            (item) => item.id !== e.detail.id
          );
          setDevices(updatedDevices);
        },
      },
      {
        event: "peers",
        handler: (e: CustomEvent<PeerInfo[]>) => addDevices(e.detail),
      },
      {
        event: "file-progress",
        handler: (e: CustomEvent) => console.log("OnFileProgress", e.detail),
      },
      {
        event: "paste",
        handler: (e: CustomEvent) => console.log("OnPaste", e.detail),
      },
      {
        event: "display-name",
        handler: (e: CustomEvent<PeerInfo>) =>
          console.log("SetDisplayName", e.detail),
      },
      {
        event: "file-received",
        handler: (e: CustomEvent) => console.log("OnFileReceived", e.detail),
      },
      {
        event: "text-recipient",
        handler: (e: CustomEvent) => console.log("OnTextRecipient", e.detail),
      },
      {
        event: "text-received",
        handler: (e: CustomEvent) => console.log("OnTextReceived", e.detail),
      },
      {
        event: LocalEvents.visibilitychange,
        handler: (e: CustomEvent) =>
          console.log("OnVisibilityChange", e.detail),
      },
    ];

    eventHandlers.forEach(({ event, handler }) => Events.on(event, handler));

    return () => {
      eventHandlers.forEach(({ event, handler }) => Events.off(event, handler));
    };
  };

  const addDevices = (peers: PeerInfo[]) => {
    setDevices((prev) => {
      const newPeers = peers.filter(
        (peer) => !prev.some((device) => device.id === peer.id)
      );

      const newDevices: Device[] = newPeers.map((peer) => ({
        id: peer.id,
        name: peer.name.displayName,
        type: "smartphone",
        orbit: prev.length < 5 ? 1 : 2,
        angle: 0,
        peer: peer,
      }));

      const updatedDevices = [...prev, ...newDevices];

      return positionDevices(updatedDevices);
    });
  };

  const positionDevices = (deviceList: Device[]): Device[] => {
    const orbits: { [key: number]: Device[] } = {};

    // Group devices by orbit
    deviceList.forEach((device) => {
      if (!orbits[device.orbit]) {
        orbits[device.orbit] = [];
      }
      orbits[device.orbit].push(device);
    });

    // Position devices in each orbit
    Object.keys(orbits).forEach((orbitKey) => {
      const orbit = parseInt(orbitKey);
      const devicesInOrbit = orbits[orbit];
      const angleStep = 360 / devicesInOrbit.length;

      devicesInOrbit.forEach((device, index) => {
        device.angle = index * angleStep;
      });
    });

    return deviceList;
  };

  const getDevicePosition = (orbit: number, angle: number) => {
    const radius = orbit * 100; // Base radius multiplied by orbit number
    const radian = (angle - 90) * (Math.PI / 180); // Convert angle to radian and offset by 90 degrees
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    return { x, y };
  };

  return (
    <div className="device-playground">
      {devices.length === 0 ? (
        <div className="searching-devices">
          <Wifi className="wifi-icon" />
          <h2>Searching for nearby devices...</h2>
          <p>
            Make sure other devices are on the same network and have Fataak
            open.
          </p>
        </div>
      ) : (
        <>
          <h2 className="devices-title">Available Devices</h2>
          <div className="orbital-view">
            <div className="orbital-circles">
              <div className="orbital-circle orbital-circle-1" />
              <div className="orbital-circle orbital-circle-2" />
              <div className="orbital-circle orbital-circle-3" />
              <div className="orbital-circle orbital-circle-4" />
            </div>

            <div className="center-device">
              <button className="device-button center">
                <Monitor className="device-icon" />
                <span className="device-name">You</span>
              </button>
            </div>

            {devices.map((device) => {
              const Icon = deviceIcons[device.type];
              const position = getDevicePosition(device.orbit, device.angle);

              return (
                <div
                  key={device.id}
                  className="orbital-device"
                  style={{
                    left: `calc(50% + ${position.x}px)`,
                    top: `calc(50% + ${position.y}px)`,
                  }}
                >
                  <button
                    className={`device-button ${
                      selectedDevice?.id === device.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      if (selectedDevice?.id !== device.id) {
                        getPeersManager().sendTo(device.id, ""); // TODO: check this
                        onDeviceSelect(device);
                      }
                    }}
                  >
                    <Icon className="device-icon" />
                    <span className="device-name">{device.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
