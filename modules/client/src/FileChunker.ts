// FileChunker.ts
class FileChunker {
    private chunkSize: number = 64000; // Example chunk size
    private offset: number = 0;

    constructor(private file: File, private onChunk: (chunk: ArrayBuffer) => void) { }

    public nextPartition() {
        const chunk = this.file.slice(this.offset, this.offset + this.chunkSize);

        const reader = new FileReader();
        reader.onload = () => {
            this.onChunk(reader.result as ArrayBuffer);
            this.offset += chunk.size;

            if (this.offset < this.file.size) {
                this.nextPartition();
            }
        };

        reader.readAsArrayBuffer(chunk);
    }
}

export default FileChunker;