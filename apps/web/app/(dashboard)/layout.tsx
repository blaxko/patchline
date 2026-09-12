import { Nav } from "../../components/dashboard/Nav";
import styles from "../../components/dashboard/Dashboard.module.css";

// No operator login on this deploy (removed by request) — the dashboard is
// reachable directly, for anyone, always.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Nav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
