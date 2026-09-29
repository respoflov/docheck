# Docheck

여러 리스트의 할 일을 「오늘 · 리스트별 · 전체」 세 화면으로 나눠 보는 체크리스트 PWA입니다. [체크리스트](https://github.com/respoflov/checklist) 앱을 전면 개조해 새로 만들었습니다.

- 배포: https://respoflov.github.io/docheck/
- 디자인 결정: [DESIGN.md](DESIGN.md) · 진행 이력: [히스토리.md](히스토리.md)

## 주요 기능

- 오늘 마감·기한 지남 항목만 모아 보는 「오늘」 화면과 빠른 추가
- 중요도 별, 마감일 자동 정렬, 서브태스크·메모
- 완료 숨김·중요만 보기 필터, 스와이프로 삭제와 실행 취소
- 5단계 글자 크기 조절, 라이트·다크 테마
- 로컬 JSON 백업, Google 계정 동기화(선택, Firebase 설정 필요)

## 파일 구성

```
index.html            화면 뼈대
style.css             스타일
app.js                앱 로직
firebase-config.js    Firebase 프로젝트 설정 자리 (기본값은 자리표시자)
firebase-sync.js      Google 로그인·Firestore 동기화
sw.js                 오프라인 캐시 서비스 워커
mockup/               디자인 시안 (승인 과정 보존)
release/              버전별 릴리스 노트
```

## 동기화 켜기 (선택)

동기화 없이도 앱은 기기 안에서 정상 동작합니다. 켜려면 `firebase-config.js` 맨 위 안내대로 Firebase 프로젝트를 만들고 값을 채우세요. Firebase 웹 설정값은 브라우저에 노출되는 것이 정상이며, 접근 제어는 Firestore 보안 규칙이 맡습니다.

## 실행

빌드 과정이 없습니다. 정적 파일 서버로 열면 됩니다. `main`에 푸시하면 GitHub Actions가 Pages로 배포합니다.

## 홈 화면에 추가

- 아이폰: 브라우저에서 주소를 연 뒤 공유 버튼(↑) → 홈 화면에 추가
- 안드로이드: 브라우저 메뉴(⋮) → 홈 화면에 추가 또는 앱 설치

## 라이선스

Copyright 2026 respoflov

이 저장소의 코드는 [Apache License 2.0](LICENSE)을 따릅니다. 앱이 사용하는 외부 폰트·라이브러리는 각자의 라이선스를 따릅니다.
