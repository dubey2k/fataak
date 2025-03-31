export enum LocalEvents {
    beforeunload = "beforeunload",
    pagehide = "pagehide",
    visibilitychange = "visibilitychange",
    notify_user = "notify-user",
}

export enum ServerEvents {
    ping = "ping",
    disconnect = "disconnect",
    peers = "peers",
    peer_joined = "peer-joined",
    peer_left = "peer-left",
    display_name = "display-name",
    pong = "pong",
    signal = "signal",
}

export enum PeerManagerEvents {
    signal = "signal",
    peers = "peers",
    files_selected = "files-selected",
    peer_left = "peer-left",
    peer_joined = "peer-joined",
    send_text = "send-text",
}

export enum PeerEvents {
    signal = "signal",
    notify_user = "notify-user",

    peer_declined = "peer-declined",
    peer_requested = "peer-requested",
    peer_disconnected = "peer-disconnected",
    peer_accepted = "peer-accepted",

    header = "header",
    partition = "partition",
    partition_received = "partition-received",
    progress = "progress",
    transfer_complete = "trasfer-complete",
    text = "text",

    file_progress = "file-progress",
    file_received = "file-recieved",

    text_received = "text-received",
    send_text = "send-text",
}

type EventType = LocalEvents | ServerEvents | PeerManagerEvents | PeerEvents;


export interface EventDetails {
    event_type: "LOCAL" | "SERVER" | "PEER";
    type: EventType;
    message?: string;
    data?: Record<string, unknown>
}

export interface PeerEvent extends EventDetails {
    event_type: "PEER";
    peer_id: string;
    type: PeerEvents;
}

export interface ServerReq extends EventDetails {
    event_type: "SERVER";
    peer_id?: string;
    type: ServerEvents | PeerManagerEvents;
}

export interface LocalEvent extends EventDetails {
    event_type: "LOCAL";
    type: LocalEvents
}

// Peer File Events
export interface PeerFileHeaderEvent extends PeerEvent {
    type: PeerEvents.header;
    data: {
        name: string;
        mime: string;
        size: number;
    }
};

export interface PeerFilePartitionEvent extends PeerEvent {
    type: PeerEvents.partition;
    partition: number;
}
export interface PeerFileProgressEvent extends PeerEvent {
    type: PeerEvents.progress | PeerEvents.file_progress;
    progress: number;
}

export class Events {
    static fire(detail: EventDetails) {
        window.dispatchEvent(new CustomEvent(detail.type.toString(), { detail: detail }));
    }

    static on(type: string, callback: (e: CustomEvent) => void) {
        return window.addEventListener(type, callback as EventListener, false);
    }

    static off(type: string, callback: (e: CustomEvent) => void) {
        return window.removeEventListener(type, callback as EventListener, false);
    }
}