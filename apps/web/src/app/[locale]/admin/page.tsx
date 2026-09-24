import { ShieldCheck, UserRound } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { listAdminUsers } from "@/lib/dashboard";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const users = await listAdminUsers();

  return (
    <main className="bg-ink-100 min-h-[70vh]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <p className="text-brand text-xs font-bold tracking-wider uppercase">Platform admin</p>
          <h1 className="font-display text-ink-900 mt-1 text-3xl font-extrabold tracking-tight">
            Users
          </h1>
          <p className="text-ink-600 mt-2 text-sm">
            Seeded user accounts available in the local BiletFlow database.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="border-ink-300 mt-8 rounded-xl border border-dashed bg-white p-12 text-center">
            <p className="text-ink-900 font-bold">No users found</p>
            <p className="text-ink-600 mt-1 text-sm">Run the database seed to populate this view.</p>
          </div>
        ) : (
          <div className="border-ink-300 mt-8 overflow-hidden rounded-xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-200 text-ink-700 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 font-bold">User</th>
                    <th className="px-5 py-3 font-bold">Role</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold">Verification</th>
                    <th className="px-5 py-3 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-ink-200 divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="text-ink-700">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-brand-tint text-brand flex size-9 items-center justify-center rounded-full">
                            <UserRound className="size-4" aria-hidden />
                          </span>
                          <div>
                            <p className="text-ink-900 font-semibold">{user.name}</p>
                            <p className="text-ink-500 text-xs">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium">{user.role}</td>
                      <td className="px-5 py-4">{user.status}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck className="size-4" aria-hidden />
                          {user.organizerProfile?.verificationStatus ??
                            (user.emailVerified ? "EMAIL VERIFIED" : "NOT VERIFIED")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                          user.createdAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
