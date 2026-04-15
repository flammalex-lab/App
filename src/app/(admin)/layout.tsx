import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminNav, AdminTopBar, ImpersonationBar } from "@/components/layout/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/guide");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-bg-primary">
      <AdminNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopBar />
        <ImpersonationBar />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
