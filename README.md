# 정석몰

정석강의 1강을 위해 실제로 구축하는 풀스택 커머스·상담·콘텐츠 생산 시스템입니다.

## 구현 범위

- 반응형 상품 탐색·검색·상세·장바구니·고객 로그인·내 주문
- 상품·검증 팩트·재고·상태 관리와 담당자 역할 분리
- 토스페이먼츠 테스트 결제·서버 승인·조회 재검증·멱등 웹훅·전액 취소
- 상품·버전 정책·본인 주문만 조회하고 문의 티켓을 만드는 상담 에이전트
- 팩트 기반 상세페이지 초안·수정·검수·승인·버전 게시
- 훅·장면 대본 수정, macOS TTS, SRT, 1080×1920 H.264 MP4, PNG 썸네일·매니페스트
- 공급자 키 AES-256-GCM 암호화, 마스킹, 비활성화, 실제 인증 연결 검사와 감사 로그

Railway 실제 프로젝트·PostgreSQL·Redis·Bucket 생성과 외부 테스트 키 입력은 인프라 변경이므로 별도 승인 후 진행합니다. 현재 저장소는 로컬 PGlite와 파일 저장소로 전체 핵심 흐름을 재현합니다.

## 로컬 시작

```bash
npm install
npm run db:init
brew install ffmpeg # macOS에서 쇼츠 MP4 렌더를 사용할 때
npm run dev -- --hostname 0.0.0.0 --port 3100
```

`DATABASE_URL`이 없으면 `.data/` 아래의 PGlite를 사용합니다. Railway에서는 `DATABASE_URL`을 통해 실제 PostgreSQL을 사용합니다.

토스페이먼츠·AI·TTS 같은 공급자 키는 환경변수에 넣지 않습니다. 최초 관리자 계정을 만든 뒤 `관리자 → 시스템 설정 → 외부 연동`에서 입력합니다.

## 접속·테스트 계정

- 정석몰: `http://localhost:3100` 또는 같은 Wi-Fi의 `http://<내부-IP>:3100`
- 최초 관리자: `/admin/setup`에서 한 번 생성
- 이후 관리자: `/admin/login`
- 고객 데모: `/account`
  - 이메일: `demo@jeongseok.test`
  - 비밀번호: `DemoCustomer1234`

관리자 비밀번호는 저장소에 포함하지 않습니다. 관리자 콘텐츠 스튜디오는 `/admin/content`입니다.

## 검증

```bash
npm run check
```

실행 중인 로컬 서버를 대상으로 승인·게시·실제 MP4 다운로드까지 점검하려면 서버를 끈 상태에서 `npm run smoke:prepare`, 서버를 다시 켠 뒤 `npm run smoke:local`, 다시 서버를 끈 뒤 `npm run smoke:cleanup` 순서로 실행합니다. PGlite는 단일 프로세스 로컬 DB라 이 순서를 지켜야 합니다.

## 문서

- [아키텍처](./docs/ARCHITECTURE.md)
- [실행 계약](./docs/EXECUTION_CONTRACT.md)
- [데모 실행서](./docs/DEMO_RUNBOOK.md)
- [결제 실행서](./docs/PAYMENT_RUNBOOK.md)
