import { useState, useEffect } from "react";
import { Laptop, Smartphone, Tablet, Wifi, Monitor } from "lucide-react";
import "./device-playground.css";
import { PeerInfo, PeersData } from "../types/PeerInfo";
import {
  Events,
  LocalEvents,
  PeerEvent,
  PeerEvents,
  PeerManagerEvents,
  ServerEvents,
} from "../utils/Events";
import { getPeersManager } from "../utils/Network";
import React from "react";

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
  const [pendingRequest, setPendingRequest] = useState<Device | null>(null);

  useEffect(() => {
    const cleanupListeners = setEventListeners();

    return () => {
      cleanupListeners();
    };
  }, []);

  const setEventListeners = () => {
    const eventHandlers = [
      {
        event: PeerEvents.peer_declined,
        handler: (e: CustomEvent<PeerInfo>) => {
          alert(`Peer declined: ${e.detail.name.displayName}`);
          setPendingRequest(null);
        },
      },
      {
        event: PeerEvents.peer_requested,
        handler: (e: CustomEvent<PeerInfo>) => {
          const ind = devices.findIndex((item) => item.id === e.detail.id);
          console.log("Peer requested", e);
          if (ind !== -1) {
            setPendingRequest(devices[ind]);
          }
        },
      },
      {
        event: PeerEvents.peer_accepted,
        handler: (e: CustomEvent<PeerInfo>) => {
          const ind = devices.findIndex((item) => item.id === e.detail.id);
          if (ind !== -1) {
            if (selectedDevice && selectedDevice.id !== devices[ind].id) {
              if (selectedDevice) {
                Events.fire({
                  type: PeerEvents.peer_disconnected,
                  peer_id: devices[ind].id,
                  message: "Peer disconnected",
                } as PeerEvent);
              }
              onDeviceSelect(devices[ind]);
            }
          }
        },
      },
      {
        event: PeerEvents.peer_disconnected,
        handler: () => {
          onDeviceSelect(null);
        },
      },
      {
        event: PeerManagerEvents.peer_joined,
        handler: (e: CustomEvent<{ peer: PeerInfo }>) =>
          addDevices([e.detail.peer]),
      },
      {
        event: PeerManagerEvents.peer_left,
        handler: (e: CustomEvent<{ peerId: string }>) => {
          const updatedDevices = devices.filter(
            (item) => item.id !== e.detail.peerId
          );
          setDevices(updatedDevices);
        },
      },
      {
        event: PeerManagerEvents.peers,
        handler: (e: CustomEvent<PeersData>) => addDevices(e.detail.peers),
      },
      {
        event: PeerEvents.file_progress,
        handler: (e: CustomEvent) => console.log("OnFileProgress", e.detail),
      },
      {
        event: ServerEvents.display_name,
        handler: (e: CustomEvent<PeerInfo>) =>
          console.log("SetDisplayName", e.detail),
      },
      {
        event: PeerEvents.file_received,
        handler: (e: CustomEvent) => console.log("OnFileReceived", e.detail),
      },
      {
        event: PeerEvents.text_received,
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

      const newDevices: Device[] = newPeers.map((peer) => {
        return {
          id: peer.id,
          name: peer.name.displayName,
          type: "smartphone",
          orbit: prev.length < 5 ? 1 : 2,
          angle: 0,
          peer: peer,
        };
      });

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

  const handleDeviceSelect = (device: Device) => {
    if (selectedDevice?.id !== device.id) {
      // Disconnect from current device if any
      if (selectedDevice) {
        Events.fire({
          type: PeerEvents.peer_disconnected,
          peer_id: device.id,
          message: "Peer disconnected",
        } as PeerEvent);
      }
      // Connect to new device
      console.log("PEER_REQUEST_DATA::", device);
      getPeersManager().sendTo(
        device.id,
        JSON.stringify({
          type: PeerEvents.peer_requested,
          id: device.id,
          name: device.name,
        })
      );
      // TODO: call this after the connection is established
      // onDeviceSelect(device);
    }
  };

  const handleAcceptRequest = () => {
    if (pendingRequest) {
      if (selectedDevice) {
        Events.fire({
          type: PeerEvents.peer_disconnected,
          peer_id: pendingRequest.id,
          message: "Peer disconnected",
        } as PeerEvent);
      }
      getPeersManager().sendTo(
        pendingRequest.id,
        JSON.stringify({
          type: "peer-accepted",
        })
      );
      onDeviceSelect(pendingRequest);
      setPendingRequest(null);
    }
  };

  const handleDeclineRequest = () => {
    if (pendingRequest) {
      getPeersManager().sendTo(
        pendingRequest.id,
        JSON.stringify({
          type: "peer-declined",
        })
      );
      setPendingRequest(null);
    }
  };

  return (
    <div className="device-playground">
      {pendingRequest && (
        <div className="peer-request-overlay">
          <div className="peer-request-dialog">
            <p>{pendingRequest.name} wants to connect</p>
            <div className="peer-request-actions">
              <button onClick={handleAcceptRequest}>Accept</button>
              <button onClick={handleDeclineRequest}>Decline</button>
            </div>
          </div>
        </div>
      )}
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
                    onClick={() => handleDeviceSelect(device)}
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
