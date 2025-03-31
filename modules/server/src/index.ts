import process, { send } from "process";
import WebSocket, { Server as WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import parser from "ua-parser-js";
import { uniqueNamesGenerator, animals, colors } from "unique-names-generator";
import { ServerEvents } from "@fataak/event-helpers/build/Events";

// Handle SIGINT and SIGTERM
const handleExit = (signal: string) => {
    console.info(`${signal} Received, exiting...`);
    process.exit(0);
};

process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));

interface PeerInfo {
    id: string;
    name: {
        model: string;
        os: string;
        browser: string;
        type: string;
        deviceName: string;
        displayName: string;
    };
    rtcSupported: boolean;
}

class SnapdropServer {
    private _wss: WebSocketServer;
    private _rooms: Record<string, Record<string, Peer>> = {};

    constructor(port: number) {
        this._wss = new WebSocketServer({ port });
        this._wss.on("connection", this._onConnection.bind(this));
        this._wss.on("headers", this._onHeaders.bind(this));

        console.log("Snapdrop is running on port", port);
    }

    private _onConnection(socket: WebSocket, request: IncomingMessage) {
        const peer = new Peer(socket, request);
        this._joinRoom(peer);
        socket.on("message", (message) => this._onMessage(peer, message));
        socket.on("error", console.error);
        this._keepAlive(peer);

        this._send(peer, {
            type: ServerEvents.display_name,
            message: {
                displayName: peer.name.displayName,
                deviceName: peer.name.deviceName,
            },
        });
    }

    private _onHeaders(headers: string[], response: IncomingMessage) {
        if (response.headers.cookie?.includes("peerid=")) return;
        (response as any).peerId = Peer.uuid();
        headers.push(`Set-Cookie: peerid=${(response as any).peerId}; SameSite=Strict; Secure`);
    }

    private _onMessage(sender: Peer, message: WebSocket.Data) {
        let parsedMessage: any;
        try {
            parsedMessage = JSON.parse(message.toString());
        } catch {
            console.error("Malformed JSON received");
            return;
        }

        switch (parsedMessage.type) {
            case "disconnect":
                this._leaveRoom(sender);
                break;
            case "pong":
                sender.lastBeat = Date.now();
                break;
            default:
                this._relayMessage(sender, parsedMessage);
        }
    }

    private _relayMessage(sender: Peer, message: any) {
        if (message.data.peer_id && this._rooms[sender.ip]) {
            const recipient = this._rooms[sender.ip][message.data.peer_id];
            if (recipient) {
                delete message.data.peer_id;
                message.sender = sender.id;
                this._send(recipient, message);
            }
        }
    }

    private _joinRoom(peer: Peer) {
        // if room doesn't exist, create it
        if (!this._rooms[peer.ip]) {
            this._rooms[peer.ip] = {};
        }

        // notify all other peers
        for (const otherPeerId in this._rooms[peer.ip]) {
            const otherPeer = this._rooms[peer.ip][otherPeerId];
            this._send(otherPeer, {
                type: 'peer-joined',
                peer: peer.getInfo()
            }, true);
        }

        // notify peer about the other peers
        const otherPeers = [];
        for (const otherPeerId in this._rooms[peer.ip]) {
            otherPeers.push(this._rooms[peer.ip][otherPeerId].getInfo());
        }

        this._send(peer, {
            type: 'peers',
            peers: otherPeers
        });

        // add peer to room
        this._rooms[peer.ip][peer.id] = peer;

    }

    private _leaveRoom(peer: Peer) {
        const room = this._rooms[peer.ip];
        if (!room || !room[peer.id]) return;

        this._cancelKeepAlive(peer);
        delete room[peer.id];
        peer.socket.terminate();

        if (Object.keys(room).length === 0) {
            delete this._rooms[peer.ip];
        } else {
            Object.values(room).forEach(otherPeer => {
                this._send(otherPeer, { type: "peer-left", peerId: peer.id });
            });
        }
    }

    private _send(peer: Peer, message: any, opt?: boolean) {
        if (peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(JSON.stringify(message), (error) => {
                if (error) console.error("Send error:", error);
            });
        }
    }

    private _keepAlive(peer: Peer) {
        this._cancelKeepAlive(peer);
        const timeout = 30000;

        if (Date.now() - peer.lastBeat > 2 * timeout) {
            this._leaveRoom(peer);
            return;
        }

        this._send(peer, { type: "ping" });
        peer.timerId = setTimeout(() => this._keepAlive(peer), timeout);
    }

    private _cancelKeepAlive(peer: Peer) {
        if (peer.timerId) {
            clearTimeout(peer.timerId);
        }
    }
}

class Peer {
    public socket: WebSocket;
    public ip: string;
    public id: string;
    public rtcSupported: boolean;
    public name: PeerInfo['name'];
    public timerId: NodeJS.Timeout | null = null;
    public lastBeat: number;

    constructor(socket: WebSocket, request: IncomingMessage) {
        this.socket = socket;
        this.ip = this._extractIP(request);
        this.id = this._extractPeerId(request);
        this.rtcSupported = request.url?.includes("webrtc") || false;
        this.name = this._generateName(request);
        this.lastBeat = Date.now();
    }

    private _extractIP(request: IncomingMessage): string {
        const forwardedFor = request.headers["x-forwarded-for"] as string;
        let ip = forwardedFor ? forwardedFor.split(/\s*,\s*/)[0] : request.socket.remoteAddress || "unknown";
        return (ip === "::1" || ip === "::ffff:127.0.0.1") ? "127.0.0.1" : ip;
    }

    private _extractPeerId(request: IncomingMessage): string {
        const peerId = (request as any).peerId;
        if (peerId) return peerId;
        const cookie = request.headers.cookie || "";
        return cookie.replace("peerid=", "");
    }

    private _generateName(req: IncomingMessage): PeerInfo['name'] {
        const ua = parser(req.headers["user-agent"] || "");
        const deviceName = `${ua.os?.name?.replace("Mac OS", "Mac") || ""} ${ua.device.model || ua.browser.name || "Unknown Device"}`.trim();

        const displayName = uniqueNamesGenerator({
            length: 2,
            separator: " ",
            dictionaries: [colors, animals],
            style: "capital",
            seed: this.id.hashCode(),
        });

        return {
            model: ua.device.model || "Unknown",
            os: ua.os.name || "Unknown",
            browser: ua.browser.name || "Unknown",
            type: ua.device.type || "Unknown",
            deviceName,
            displayName,
        };
    }

    public getInfo(): PeerInfo {
        return {
            id: this.id,
            name: this.name,
            rtcSupported: this.rtcSupported,
        };
    }

    public static uuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

declare global {
    interface String {
        hashCode(): number;
    }
}

String.prototype.hashCode = function (): number {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
        const chr = this.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

const server = new SnapdropServer(Number(process.env.PORT) || 3000);