# 정석몰

정석강의 1강을 위해 실제로 구축하는 풀스택 커머스·상담·콘텐츠 생산 시스템입니다.

## 현재 범위

- 정석몰 상품 탐색·장바구니·주문
- 관리자 외부 연동 키 입력·암호화·검증
- 토스페이먼츠 테스트 결제·승인·조회·취소
- 상품·정책·본인 주문을 조회하는 상담 에이전트
- 상품 팩트 기반 상세페이지 생성·검수·게시
- 상품 소개 쇼츠 대본·음성·자막·MP4 생성
- Railway web·worker·render-worker·PostgreSQL·Redis·Storage 배포

## 로컬 시작

```bash
npm install
npm run db:init
npm run dev -- --port 3100
```

`DATABASE_URL`이 없으면 `.data/` 아래의 PGlite를 사용합니다. Railway에서는 `DATABASE_URL`을 통해 실제 PostgreSQL을 사용합니다.

토스페이먼츠·AI·TTS 같은 공급자 키는 환경변수에 넣지 않습니다. 최초 관리자 계정을 만든 뒤 `관리자 → 시스템 설정 → 외부 연동`에서 입력합니다.

## 문서

- [PRD](../PRD_v0.2.md)
- [아키텍처](./docs/ARCHITECTURE.md)
- [실행 계약](./docs/EXECUTION_CONTRACT.md)
