# 정석몰 아키텍처 v0.1

## 배포 토폴로지

```text
Browser
  └─ Railway web (Next.js)
       ├─ PostgreSQL
       ├─ Redis queue
       └─ Storage Bucket

Railway worker
  ├─ 상세페이지 카피·이미지·TTS
  ├─ PostgreSQL
  ├─ Redis queue
  └─ Storage Bucket

Railway render-worker
  ├─ Remotion/Chromium/FFmpeg
  ├─ PostgreSQL
  ├─ Redis queue
  └─ Storage Bucket
```

## 모듈 경계

| 모듈 | 책임 |
|---|---|
| commerce | 상품·옵션·재고·장바구니·주문 |
| payments-toss | 결제 요청·금액 검증·승인·조회·취소 |
| credentials | 관리자 입력 키 암호화·범위·교체·검증 |
| consultation-agent | 상품·정책·본인 주문 도구와 실행 기록 |
| content-engine | 팩트 원장·상세페이지·쇼츠 구성 |
| video | 자막·음성·장면·MP4 렌더 |
| observability | 요청·모델·도구·작업·비용·산출물 계보 |

## 자격증명

공급자 키는 관리자 UI에서 입력하고 AES-256-GCM으로 암호화해 DB에 저장합니다. `CREDENTIALS_MASTER_KEY`와 Railway 내부 연결 정보만 부트스트랩 비밀로 분리합니다. 공급자 키 원문은 브라우저 응답·queue payload·로그·산출물에 넣지 않습니다.

## 로컬과 Railway

로컬에서는 PGlite가 PostgreSQL 호환 SQL을 파일에 저장합니다. Railway에서는 같은 쿼리 계약을 `pg.Pool`로 실행합니다. 배포 전 실제 PostgreSQL 통합 테스트를 별도로 수행합니다.
