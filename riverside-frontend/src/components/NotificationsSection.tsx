
import type { NotificationRecord } from "../types";

interface NotificationsSectionProps {
  notifications: NotificationRecord[];
  onRead: (id: string) => void;
}

export default function NotificationsSection({
  notifications,
  onRead,
}: NotificationsSectionProps) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: 18,
        padding: "1.5rem",
        boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
      }}
    >
      <h2>Notifications</h2>
      {notifications.length === 0 ? <p>No notifications yet.</p> : null}
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>
            <span style={{ fontWeight: notification.read ? 400 : 700 }}>
              {notification.message}
            </span>{" "}
            {!notification.read ? (
              <button
                type="button"
                onClick={() => onRead(notification.id)}
              >
                Mark as read
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
