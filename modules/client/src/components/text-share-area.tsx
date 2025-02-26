import { Clipboard, Send } from "lucide-react";
import "./text-share-area.css";

export const TextShareArea: React.FC<{
  onTextSend: (text: string) => Promise<void>;
}> = ({ onTextSend }) => {
  return (
    <section className="text-share-area">
      <h2>Share Text</h2>
      <div className="text-share-content">
        <textarea
          className="text-input"
          placeholder="Type or paste text to share..."
        />
        <div className="text-share-actions">
          <button className="sync-clipboard-button">
            <Clipboard />
            Sync Clipboard
          </button>
          <button
            onClick={async () => {
              await onTextSend("text");
            }}
            className="send-button"
          >
            <Send />
            Send
          </button>
        </div>
      </div>
    </section>
  );
};
