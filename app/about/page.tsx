import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export default function AboutPage() {
  return <main className="about-page"><section><span className="kicker">ABOUT JEONGSEOK</span><h1>프롬프트로 만들고,<br />실제 구조로 증명합니다.</h1><p>정석몰은 정석강의 1강을 위해 먼저 실제로 구축하는 기준 산출물입니다. 쇼핑몰·상담 에이전트·토스페이먼츠·상세페이지·쇼츠 생성이 하나의 시스템에서 어떻게 연결되는지 보여줍니다.</p><Link className="primary-button" href="/products">정석몰 둘러보기 <ArrowIcon /></Link></section><div className="about-grid"><article><span>01</span><h2>BUILD</h2><p>몇 번의 명확한 요구와 피드백으로 풀스택 시스템을 완성합니다.</p></article><article><span>02</span><h2>TRACE</h2><p>화면에서 서버·DB·외부 API·worker까지 같은 ID로 따라갑니다.</p></article><article><span>03</span><h2>TEACH</h2><p>실제 구축 증거와 재현 프롬프트 팩을 만든 뒤 강의 뼈대를 설계합니다.</p></article></div></main>;
}
