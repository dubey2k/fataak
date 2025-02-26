export enum LocalEvents {
    beforeunload = "beforeunload", // browser event used to notify server 
    pagehide = "pagehide", // browser event used to notify server 
    visibilitychange = "visibilitychange",  // browser event used to notify server 
}

export enum ServerEvents {
    ping = "ping",
    disconnect = "disconnect",
    peers = "peers",
    peer_joined = "peer-joined",
    peer_left = "peer-left",
    display_name = "display-name",
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

    header = "header",
    partition = "partition",
    partition_received = "partition-received",
    progress = "progress",
    trasfer_complete = "trasfer-complete",
    text = "text",

    file_progress = "file-progress",
    file_recieved = "file-recieved",

    text_received = "text-received",
    text_recipient = "text-recipient",
    send_text = "send-text",
}

export class Events {
    static fire(type: string, detail: Record<string, unknown>) {
        window.dispatchEvent(new CustomEvent(type, { detail: detail }));
    }

    static on(type: string, callback: (e: CustomEvent) => void) {
        return window.addEventListener(type, callback as EventListener, false);
    }

    static off(type: string, callback: (e: CustomEvent) => void) {
        return window.removeEventListener(type, callback as EventListener, false);
    }
}


/*

Local:
beforeunload
pagehide
visibilitychange

Server Connection:
peers
peer-joined
peer-left
signal
ping
display-name

Peer Manager Events:
signal
peers
files-selected
peer-left
send-text // sending text to a peer > received as text event in Peer

Peer Events:
notify-user
peer-declined
peer-requested
peer-disconnected
header
partition
partition-received
progress
trasfer-complete
text  // text recieved event
file-progress
file-received


*/