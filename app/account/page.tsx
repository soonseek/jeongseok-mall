import Link from "next/link";
import { ArrowIcon, UserIcon } from "@/components/icons";

export default function AccountPage() {
  return <main className="account-page"><div className="account-card"><UserIcon size={36} /><span className="kicker">CUSTOMER ACCOUNT</span><h1>데모 고객 로그인</h1><p>토스페이먼츠 결제와 본인 주문 상담을 위해 고객 인증을 연결하는 단계입니다.</p><div className="account-status"><span>현재 상태</span><strong>인증 모듈 구축 중</strong></div><Link className="primary-button" href="/products">상품 먼저 둘러보기 <ArrowIcon /></Link></div></main>;
}
