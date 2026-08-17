import { ContentStudio } from "@/components/content-studio";
import { requireAdmin } from "@/lib/auth";
import { listContentProducts, listDetailVersions, listShortProjects } from "@/lib/db/content";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const admin = await requireAdmin();
  const [products, details, shorts] = await Promise.all([listContentProducts(), listDetailVersions(), listShortProjects()]);
  return <>
    <header className="admin-page-header"><div><span>CONTENT OPERATIONS</span><h1>정석 콘텐츠 스튜디오</h1><p>팩트 기반 상세페이지를 검수·승인·게시하고 소개 쇼츠 산출물을 만듭니다.</p></div><b>{products.length} PRODUCTS</b></header>
    <main className="admin-page-body"><ContentStudio initialProducts={products} initialDetails={details} initialShorts={shorts} canApprove={["ADMIN", "SUPER_ADMIN"].includes(admin.role)} /></main>
  </>;
}
