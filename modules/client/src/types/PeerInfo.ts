export type PeerInfo = {
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

export type PeersData = {
    peers: PeerInfo[];
}