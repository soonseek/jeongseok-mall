import { Suspense } from "react";
import { PaymentResult } from "@/components/payment-result";

export default function PaymentSuccessPage() {
  return <Suspense fallback={<main className="result-page">결제 확인 중…</main>}><PaymentResult /></Suspense>;
}
