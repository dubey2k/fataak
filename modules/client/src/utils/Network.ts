import { Events, LocalEvents, PeerEvents, PeerManagerEvents, ServerEvents } from "./Events";

const isRtcSupported = !!(window.RTCPeerConnection)
// || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);

interface Message {
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface SignalMessage extends Message {
    sdp?: RTCSessionDescriptionInit;
    ice?: RTCIceCandidateInit;
    sender?: string;
}

class ServerConnection {
    private _socket: WebSocket | null = null;
    private _reconnectTimer: NodeJS.Timeout | undefined;

    constructor() {
        this._connect();
        Events.on(LocalEvents.beforeunload, () => this._disconnect());
        Events.on(LocalEvents.pagehide, () => this._disconnect());
        document.addEventListener(LocalEvents.visibilitychange, () => this._onVisibilityChange());
    }

    private _connect() {
        if (this._reconnectTimer)
            clearTimeout(this._reconnectTimer!);
        if (this._isConnected() || this._isConnecting()) return;
        const ws = new WebSocket(this._endpoint());
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => console.log('WS: server connected');
        ws.onmessage = (e: MessageEvent) => this._onMessage(e.data);
        ws.onclose = () => this._onDisconnect();
        ws.onerror = (e: Event) => console.error(e);
        this._socket = ws;
    }

    private _onMessage(msg: string) {
        const message: Message = JSON.parse(msg);
        if (message.type != "signal")
            console.log('WS:', message);
        switch (message.type) {
            case ServerEvents.peers:
                Events.fire(PeerManagerEvents.peers, message.peers);
                break;
            case ServerEvents.peer_joined:
                Events.fire(PeerManagerEvents.peer_joined, message.peer);
                break;
            case ServerEvents.peer_left:
                Events.fire(PeerManagerEvents.peer_left, message.peerId);
                break;
            case "signal":
                Events.fire("signal", message);
                break;
            case ServerEvents.ping:
                this.send({ type: 'pong' });
                break;
            case ServerEvents.display_name:
                Events.fire(ServerEvents.display_name, message);
                break;
            default:
                console.error('WS: unknown message type', message);
        }
    }

    send(message: Message) {
        if (!this._isConnected()) return;
        this._socket!.send(JSON.stringify(message));
    }

    private _endpoint(): string {
        const protocol = location.protocol.startsWith('https') ? 'wss' : 'ws';
        const webrtc = isRtcSupported ? 'webrtc' : 'fallback';
        const url = `${protocol}://192.168.1.8:3000/${webrtc}`;
        //TODO: change this while deployment
        // const url = `${protocol}://${location.host}${location.pathname}server${webrtc}`;
        return url;
    }

    private _disconnect() {
        this.send({ type: ServerEvents.disconnect });
        if (this._socket) {
            this._socket.onclose = null;
            this._socket.close();
        }
    }

    private _onDisconnect() {
        console.log('WS: server disconnected');
        Events.fire(PeerEvents.notify_user, { "message": 'Connection lost. Retry in 5 seconds...' });
        if (this._reconnectTimer)
            clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this._connect(), 5000);
    }

    private _onVisibilityChange() {
        if (document.hidden) return;
        this._connect();
    }

    private _isConnected(): boolean {
        return this._socket !== null && this._socket.readyState === WebSocket.OPEN;
    }

    private _isConnecting(): boolean {
        return this._socket !== null && this._socket.readyState === WebSocket.CONNECTING;
    }
}

export abstract class Peer {
    protected _server: ServerConnection;
    _peerId: string;
    private _filesQueue: File[] = [];
    private _busy: boolean = false;
    private _chunker: FileChunker | null = null;
    private _digester: FileDigester | null = null;
    private _lastProgress: number = 0;

    abstract _send(message: string | ArrayBuffer): void;

    abstract refresh(): void;

    constructor(serverConnection: ServerConnection, peerId: string) {
        this._server = serverConnection;
        this._peerId = peerId;
    }

    sendJSON(message: Message) {
        this._send(JSON.stringify(message));
    }

    sendFiles(files: File[]) {
        for (let i = 0; i < files.length; i++) {
            this._filesQueue.push(files[i]);
        }
        if (this._busy) return;
        this._dequeueFile();
    }

    private _dequeueFile() {
        if (!this._filesQueue.length) return;
        this._busy = true;
        const file = this._filesQueue.shift()!;
        this._sendFile(file);
    }

    private _sendFile(file: File) {
        this.sendJSON({
            type: PeerEvents.header,
            name: file.name,
            mime: file.type,
            size: file.size
        });
        this._chunker = new FileChunker(file,
            (chunk: ArrayBuffer) => this._send(chunk),
            (offset: number) => this._onPartitionEnd(offset));
        this._chunker.nextPartition();
    }

    private _onPartitionEnd(offset: number) {
        this.sendJSON({ type: PeerEvents.partition, offset: offset });
    }

    private _onReceivedPartitionEnd(offset: number) {
        this.sendJSON({ type: PeerEvents.partition_received, offset: offset });
    }

    private _sendNextPartition() {
        if (!this._chunker || this._chunker.isFileEnd()) return;
        this._chunker.nextPartition();
    }

    private _sendProgress(progress: number) {
        this.sendJSON({ type: 'progress', progress: progress });
    }

    _onMessage(message: string | ArrayBuffer) {
        if (typeof message !== 'string') {
            this._onChunkReceived(message);
            return;
        }
        const parsedMessage: Message = JSON.parse(message);
        console.log("WS:", parsedMessage);
        switch (parsedMessage.type) {
            case 'peer-declined':
                Events.fire('peer-declined', { "message": parsedMessage });
                break;
            case 'peer-requested':
                Events.fire('peer-requested', { "message": parsedMessage });
                break;
            case 'peer-disconnected':
                Events.fire('peer-disconnected', { "message": parsedMessage });
                break;
            case 'header':
                this._onFileHeader(parsedMessage);
                break;
            case 'partition':
                this._onReceivedPartitionEnd(parsedMessage.offset);
                break;
            case 'partition-received':
                this._sendNextPartition();
                break;
            case 'progress':
                this._onDownloadProgress(parsedMessage.progress);
                break;
            case 'transfer-complete':
                this._onTransferCompleted();
                break;
            case 'text':
                this._onTextReceived(parsedMessage);
                break;
        }
    }

    private _onFileHeader(header: Message) {
        this._lastProgress = 0;
        this._digester = new FileDigester({
            name: header.name,
            mime: header.mime,
            size: header.size
        }, (file: unknown) => this._onFileReceived(file));
    }

    private _onChunkReceived(chunk: ArrayBuffer) {
        if (!chunk.byteLength) return;

        this._digester!.unchunk(chunk);
        const progress = this._digester!.progress;
        this._onDownloadProgress(progress);

        if (progress - this._lastProgress < 0.01) return;
        this._lastProgress = progress;
        this._sendProgress(progress);
    }

    private _onDownloadProgress(progress: number) {
        Events.fire('file-progress', { sender: this._peerId, progress: progress });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _onFileReceived(proxyFile: any) {
        Events.fire('file-received', proxyFile);
        this.sendJSON({ type: 'transfer-complete' });
    }

    private _onTransferCompleted() {
        this._onDownloadProgress(1);
        this._busy = false;
        this._dequeueFile();
        Events.fire('notify-user', { "message": 'File transfer completed.' });
    }

    sendText(text: string) {
        const unescaped = btoa(unescape(encodeURIComponent(text)));
        this.sendJSON({ type: 'text', text: unescaped });
    }

    private async _onTextReceived(message: Message) {
        try {
            // await navigator.clipboard.writeText("Amit Dubey");
            const escaped = decodeURIComponent(atob(message.text));
            alert(escaped);
            Events.fire('text-received', { text: escaped, sender: this._peerId });
        } catch (error) {
            console.error((error as Error).message);
        }
    }
}

class RTCPeer extends Peer {
    private _channel: RTCDataChannel | null = null;
    private _isCaller: boolean = false;
    _conn: RTCPeerConnection | null = null;

    static config = {
        'sdpSemantics': 'unified-plan',
        'iceServers': [{
            urls: 'stun:stun.l.google.com:19302'
        }]
    }

    constructor(serverConnection: ServerConnection, peerId?: string) {
        super(serverConnection, peerId || '');
        if (peerId) {
            this._connect(peerId, true);
        }
    }

    private _connect(peerId: string, isCaller: boolean) {
        if (!this._conn) this._openConnection(peerId, isCaller);

        if (isCaller) {
            this._openChannel();
        } else {
            this._conn!.ondatachannel = (e: RTCDataChannelEvent) => this._onChannelOpened(e);
        }
    }

    private _openConnection(peerId: string, isCaller: boolean) {
        this._isCaller = isCaller;
        this._peerId = peerId;
        this._conn = new RTCPeerConnection(RTCPeer.config);
        this._conn.onicecandidate = (e: RTCPeerConnectionIceEvent) => this._onIceCandidate(e);
        this._conn.onconnectionstatechange = () => this._onConnectionStateChange();
        this._conn.oniceconnectionstatechange = () => this._onIceConnectionStateChange();
    }

    private _openChannel() {
        const channel = this._conn!.createDataChannel('data-channel', {
            ordered: true
        });
        channel.onopen = (e: Event) => this._onChannelOpened(e);
        this._conn!.createOffer().then(d => this._onDescription(d)).catch(e => this._onError(e));
    }

    private _onDescription(description: RTCSessionDescriptionInit) {
        this._conn!.setLocalDescription(description)
            .then(() => this._sendSignal({ type: "signal", sdp: description }))
            .catch(e => this._onError(e));
    }

    private _onIceCandidate(event: RTCPeerConnectionIceEvent) {
        if (!event.candidate) return;
        this._sendSignal({ type: "signal", ice: event.candidate });
    }

    onServerMessage(message: SignalMessage) {
        if (!this._conn) this._connect(message.sender!, false);

        if (message.sdp) {
            this._conn!.setRemoteDescription(new RTCSessionDescription(message.sdp))
                .then(() => {
                    if (message.sdp!.type === 'offer') {
                        return this._conn!.createAnswer()
                            .then(d => this._onDescription(d));
                    }
                })
                .catch(e => this._onError(e));
        } else if (message.ice) {
            this._conn!.addIceCandidate(new RTCIceCandidate(message.ice));
        }
    }

    private _onChannelOpened(event: RTCDataChannelEvent | Event) {
        console.log('RTC: channel opened with', this._peerId);
        const channel = (event as RTCDataChannelEvent).channel || (event.target as RTCDataChannel);
        channel.binaryType = 'arraybuffer';
        channel.onmessage = (e: MessageEvent) => this._onMessage(e.data);
        channel.onclose = () => this._onChannelClosed();
        this._channel = channel;
    }

    private _onChannelClosed() {
        console.log('RTC: channel closed', this._peerId);
        if (!this._isCaller) return;
        this._connect(this._peerId, true);
    }

    private _onConnectionStateChange() {
        console.log('RTC: state changed:', this._conn!.connectionState);
        switch (this._conn!.connectionState) {
            case 'disconnected':
                this._onChannelClosed();
                break;
            case 'failed':
                this._conn = null;
                this._onChannelClosed();
                break;
        }
    }

    private _onIceConnectionStateChange() {
        switch (this._conn!.iceConnectionState) {
            case 'failed':
                console.error('ICE Gathering failed');
                break;
            default:
                console.log('ICE Gathering', this._conn!.iceConnectionState);
        }
    }

    private _onError(error: Error) {
        console.error(error);
    }

    // _send(message: string) {
    _send(message: string | ArrayBuffer) {
        if (!this._channel) return this.refresh();

        if (typeof message == 'string') {
            this._channel.send(message as string);
        } else {
            this._channel.send(message as ArrayBuffer);
        }
    }

    private _sendSignal(signal: SignalMessage) {
        signal.type = 'signal';
        signal.to = this._peerId;
        this._server.send(signal);
    }

    refresh() {
        if (this._isConnected() || this._isConnecting()) return;
        this._connect(this._peerId, this._isCaller);
    }

    private _isConnected(): boolean {
        return this._channel !== null && this._channel.readyState === 'open';
    }

    private _isConnecting(): boolean {
        return this._channel !== null && this._channel.readyState === 'connecting';
    }
}

class PeersManager {
    private static instance: PeersManager | null = null;
    peers: { [key: string]: Peer } = {};
    private _server: ServerConnection;

    private constructor(serverConnection: ServerConnection) {
        this._server = serverConnection;
        Events.on(PeerManagerEvents.signal, (e: CustomEvent) => this._onMessage(e.detail));
        Events.on(PeerManagerEvents.peers, (e: CustomEvent) => this._onPeers(e.detail));
        Events.on(PeerManagerEvents.files_selected, (e: CustomEvent) => this._onFilesSelected(e.detail));
        Events.on(PeerManagerEvents.send_text, (e: CustomEvent) => this._onSendText(e.detail));
        Events.on(PeerManagerEvents.peer_left, (e: CustomEvent) => this._onPeerLeft(e.detail));
    }

    public static getInstance(): PeersManager {
        if (!PeersManager.instance) {
            PeersManager.instance = new PeersManager(new ServerConnection());
        }
        return PeersManager.instance;
    }

    private _onMessage(message: SignalMessage) {
        if (!this.peers[message.sender!]) {
            this.peers[message.sender!] = new RTCPeer(this._server);
        }
        (this.peers[message.sender!] as RTCPeer).onServerMessage(message);
    }

    private _onPeers(peers: {
        id: string;
        rtcSupported: boolean;
    }[]) {
        peers.forEach(peer => {
            if (this.peers[peer.id]) {
                this.peers[peer.id].refresh();
                return;
            }
            if (isRtcSupported && peer.rtcSupported) {
                this.peers[peer.id] = new RTCPeer(this._server, peer.id);
            } else {
                this.peers[peer.id] = new WSPeer(this._server, peer.id);
            }
        });
    }

    sendTo(peerId: string, message: string) {
        this.peers[peerId]._send(message);
    }

    private _onFilesSelected(message: { to: string, files: File[] }) {
        this.peers[message.to].sendFiles(message.files);
    }

    private _onSendText(message: { to: string, text: string }) {
        this.peers[message.to].sendText(message.text);
    }

    private _onPeerLeft(peerId: string) {
        const peer = this.peers[peerId];
        delete this.peers[peerId];
        if (!peer || !(peer instanceof RTCPeer)) return;
        peer._conn?.close();
    }
}

class WSPeer extends Peer {
    refresh(): void {
        throw new Error("Method not implemented.");
    }
    constructor(serverConnection: ServerConnection, peerId: string) {
        super(serverConnection, peerId);
    }

    _send(message: string | ArrayBuffer) {
        const msg: Message = typeof message === 'string' ? JSON.parse(message) : { type: 'binary', data: message };
        msg.to = this._peerId;
        this._server.send(msg);
    }
}

class FileChunker {
    private _chunkSize: number = 64000; // 64 KB
    private _maxPartitionSize: number = 1e6; // 1 MB
    private _offset: number = 0;
    private _partitionSize: number = 0;
    private _file: File;
    private _onChunk: (chunk: ArrayBuffer) => void;
    private _onPartitionEnd: (offset: number) => void;
    private _reader: FileReader;

    constructor(file: File, onChunk: (chunk: ArrayBuffer) => void, onPartitionEnd: (offset: number) => void) {
        this._file = file;
        this._onChunk = onChunk;
        this._onPartitionEnd = onPartitionEnd;
        this._reader = new FileReader();
        this._reader.addEventListener('load', (e: ProgressEvent<FileReader>) => this._onChunkRead(e.target!.result as ArrayBuffer));
    }

    nextPartition() {
        this._partitionSize = 0;
        this._readChunk();
    }

    private _readChunk() {
        const chunk = this._file.slice(this._offset, this._offset + this._chunkSize);
        this._reader.readAsArrayBuffer(chunk);
    }

    private _onChunkRead(chunk: ArrayBuffer) {
        this._offset += chunk.byteLength;
        this._partitionSize += chunk.byteLength;
        this._onChunk(chunk);
        if (this.isFileEnd()) return;
        if (this._isPartitionEnd()) {
            this._onPartitionEnd(this._offset);
            return;
        }
        this._readChunk();
    }

    repeatPartition() {
        this._offset -= this._partitionSize;
        this.nextPartition();
    }

    private _isPartitionEnd(): boolean {
        return this._partitionSize >= this._maxPartitionSize;
    }

    isFileEnd(): boolean {
        return this._offset >= this._file.size;
    }

    get progress(): number {
        return this._offset / this._file.size;
    }
}

class FileDigester {
    private _buffer: ArrayBuffer[] = [];
    private _bytesReceived: number = 0;
    private _size: number;
    private _mime: string;
    private _name: string;
    private _callback: (file: unknown) => void;
    progress: number = 0;

    constructor(meta: { name: string, mime: string, size: number }, callback: (file: unknown) => void) {
        this._size = meta.size;
        this._mime = meta.mime || 'application/octet-stream';
        this._name = meta.name;
        this._callback = callback;
    }

    unchunk(chunk: ArrayBuffer) {
        this._buffer.push(chunk);
        this._bytesReceived += chunk.byteLength || chunk.byteLength;
        this.progress = this._bytesReceived / this._size;
        if (isNaN(this.progress)) this.progress = 1;

        if (this._bytesReceived < this._size) return;
        const blob = new Blob(this._buffer, { type: this._mime });
        this._callback({
            name: this._name,
            type: this._mime,
            size: this._size,
            blob: blob
        });
    }
}

PeersManager.getInstance();


export const getPeersManager = PeersManager.getInstance;
