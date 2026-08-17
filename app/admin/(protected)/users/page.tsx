import { StaffUserManager } from "@/components/staff-user-manager";
import { requireSuperAdmin } from "@/lib/auth";
import { listStaffUsers } from "@/lib/db/auth";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const users = await listStaffUsers();
  return <><header className="admin-page-header"><div><span>ACCESS CONTROL</span><h1>담당자·권한</h1><p>콘텐츠 담당자와 관리자를 분리하고 비활성화 시 세션을 즉시 종료합니다.</p></div><b>{users.length} STAFF</b></header><main className="admin-page-body"><StaffUserManager initial={users} /></main></>;
}
