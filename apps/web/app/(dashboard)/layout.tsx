import { Nav } from "../../components/dashboard/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Nav />
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}
