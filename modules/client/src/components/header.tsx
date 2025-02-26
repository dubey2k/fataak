import { Share2 } from "lucide-react";
import "./header.css";

export function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <Share2 className="header-icon" />
        <h1 className="header-title">QuickShare</h1>
      </div>
      <p className="header-description">
        Instant file and text sharing across devices
      </p>
    </header>
  );
}
