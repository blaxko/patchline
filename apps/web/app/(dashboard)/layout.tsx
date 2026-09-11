import { Nav } from "../../components/dashboard/Nav";
import { AuthGate } from "../../components/dashboard/AuthGate";
import styles from "../../components/dashboard/Dashboard.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className={styles.shell}>
        <Nav />
        <div className={styles.content}>{children}</div>
      </div>
    </AuthGate>
  );
}
