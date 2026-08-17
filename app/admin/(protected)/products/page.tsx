import { ProductAdminTable } from "@/components/product-admin-table";
import { adminProducts } from "@/lib/db/admin";

export default async function AdminProductsPage() {
  const products = await adminProducts();
  return <><header className="admin-page-header"><div><span>COMMERCE</span><h1>상품 관리</h1><p>상담과 콘텐츠 자동화가 함께 읽는 상품 원본을 관리합니다.</p></div><b>{products.length} PRODUCTS</b></header><main className="admin-page-body"><ProductAdminTable initial={products} /></main></>;
}
