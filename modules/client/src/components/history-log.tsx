import { Clock } from 'lucide-react'
import './history-log.css'

const historyItems = [
  { type: "File", name: "document.pdf", time: "2 min ago" },
  { type: "Text", name: "Meeting notes", time: "5 min ago" },
  { type: "File", name: "image.jpg", time: "10 min ago" },
]

export function HistoryLog() {
  return (
    <section className="history-log">
      <h2>History</h2>
      <ul className="history-list">
        {historyItems.map((item, index) => (
          <li key={index} className="history-item">
            <div className="history-item-info">
              <Clock className="history-icon" />
              <span className="history-name">{item.name}</span>
            </div>
            <div className="history-item-meta">
              <span className="history-time">{item.time}</span>
              <span className="history-type">{item.type}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

