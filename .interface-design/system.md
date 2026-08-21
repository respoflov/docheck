# CHECK-CHECK 디자인 시스템

## 방향
종이 장부, 인덱스 카드함. 라이트는 01_checklist의 세이지그린 잉크 정체성을 그대로 유지하고, 다크는 그린을 완전히 빼고 흑연(무채색) 톤으로 별도 설계했다. 시그니처는 리스트 선택자를 서류철 인덱스 탭으로 만든 것과, 카드 왼쪽의 얇은 액센트 스파인이다.

## 깊이 전략
라이트는 옅은 그림자(`--card-shadow`), 다크는 보더 중심(그림자 없음, `--card-shadow:none`). 카드는 항상 1px 보더 + 16px 라운드.

## 간격 기준
기본 단위 대략 4px 배수. 항목 행 padding 10px 0, 카드 padding 14px 16px 12px 20px(왼쪽은 스파인 폭만큼 더 줌).

## 타이포 스케일 (rem, `html{font-size}`가 기준)
5단계 사용자 조절: 13/14/15/16/17px 중 하나가 `html` 루트 font-size가 되고, 아래 rem 값들이 함께 스케일된다. 값이 바뀔 때 `html{transition:font-size .15s ease}`로 부드럽게 이어지게 했다.

| 용도 | 크기 |
|---|---|
| 항목 본문(.txt) | 0.93rem |
| 카드 제목(.cardtitle) | 1rem |
| 배지/칩/탭(.due, .tglchip, .seg, .tabs) | 0.8rem |
| 캡션류(.listpill, .grouplabel, .subrow) | 0.72~0.75rem |
| 워드마크 | 17px 고정. 사용자 글자 크기 조절과 무관하게 브랜드 안정성을 위해 고정했다 |

## 색 토큰
```
라이트: --bg:#F0F2EE --surface:#FFFFFF --ink:#262B27 --muted:#616C64 --line:#D7DED6
        --accent:#4D6152 --accent-soft:#E4EAE5
        --danger:#B0503C --danger-ink:#9A4530 --danger-soft:#F6E8E3   (배지 텍스트는 -ink 사용)
        --today:#A97B2F --today-ink:#8C6323 --today-soft:#F3EBD9
다크:   --bg:#17181A --surface:#212327 --ink:#E7E7E4 --muted:#8A8D93 --line:#33353A
        --accent:#C9CBCE (그린 아님, 중립 라이트그레이) --accent-soft:#3A3D42
        --danger:#D98B74 --today:#D6A957 (다크는 -ink와 base가 동일, 이미 AA 통과)
```

**중요**: `--danger`/`--today`는 아이콘·별 채움 등 UI 컴포넌트용(3:1 기준으로 충분)이고, `--danger-ink`/`--today-ink`는 배지처럼 작은 텍스트용(4.5:1 확보)이다. 라이트 모드에서만 분리되어 있고 다크는 이미 둘 다 통과라 값이 같다.

## 명암 대비 실측 (WCAG 상대휘도 공식으로 직접 계산, 2026-08-21)
| 텍스트 | 배경 | 결과 |
|---|---|---|
| 라이트 보조 텍스트 #616C64 | #FFFFFF | 5.5:1 |
| 라이트 "오늘" 배지 글자 #8C6323 | #F3EBD9 | 4.5:1 |
| 라이트 기한초과 배지 글자 #9A4530 | #F6E8E3 | 5.4:1 |
| 다크 전체 | - | 4.7~14.3:1 |
전부 WCAG AA(4.5:1, 작은 텍스트 기준) 통과.

## 컴포넌트 패턴
- **체크박스**: 21×21px, radius 6px, 보더 1.6px. 탭 히트 영역은 `::after{inset:-7px}`로 확장(약 35px).
- **별(중요도)**: 17×17px, 히트 영역 `::after{inset:-9px}`(약 35px). on 상태는 --today 채움.
- **카드 스파인**: `.card::before` 왼쪽 4px 폭, --accent, opacity .85.
- **인덱스 탭**: 활성 탭만 --surface 배경으로 카드와 맞붙어 폴더 탭처럼 보이게 했다. `margin-top:-1px`로 카드 상단 보더와 겹친다.
- **화면 전환 캐러셀(오늘/전체/리스트별)**: `.panels-viewport{overflow:hidden}` 안에 `.panels-track{display:flex}`을 두고, 각 `.panel{flex:0 0 100%}`로 만든다. `translateX(-idx*100%)`만 쓰면 패널 개수가 몇 개든 반올림 오차 없이 정확히 들어맞는다(처음엔 `width:300%` + `33.3333%`로 만들었다가 소수점 자릿수가 안 맞아 경계에 다음 화면이 살짝 비치는 버그가 났다).
- **스와이프 삭제**: pointerdown/move/up으로 수평 드래그만 인식한다(첫 8px 이동으로 수평/수직 판정). -60px를 넘으면 삭제하고 4초 실행취소 스낵바를 띄운다. 화면 전환 스와이프와 겹치지 않도록, 화면 전환 쪽 pointerdown 핸들러는 `.item` 위에서 시작한 터치를 아예 무시한다.
- **오버플로 메뉴**: `.card`(position:relative) 기준 `position:absolute; top:32px; right:-4px`로 띄운다. 반드시 트리거 버튼이 있는 컨테이너를 기준으로 위치시켜야 한다(화면 전체 기준으로 잡으면 엉뚱한 곳에 뜨는 버그를 실제로 겪었다).

## 자주 겪은 버그 (재발 방지용 기록)
1. `.tabs span`처럼 넓은 후손 선택자가 `.caret`/`.tab-input` 같은 특정 요소에 의도치 않게 상속되어 padding/background가 깨졌다. 항상 `.tabs .특정클래스`로 부모를 명시해 특이도를 높일 것.
2. `[hidden]` 속성은 브라우저 기본 스타일(`display:none`)인데, 같은 요소에 `display:flex` 같은 author 규칙을 걸면 origin 우선순위상 author가 이겨서 hidden이 무시된다. `[hidden]{display:none !important}`를 전역에 깔아둘 것.
3. 인라인 편집 입력창에서 `keydown Enter`로 커밋 후 리렌더로 입력창이 DOM에서 제거되면, 그 직후 `blur` 이벤트가 자동 발생해 커밋 로직이 두 번 실행된다(텍스트 수정은 무해하지만 배열에 push하는 로직은 중복 추가된다). `settled` 플래그로 한 번만 실행되게 가드할 것.
4. `<input type="date">`는 CSS width를 강제로 줄여도 로케일 포맷 최소 폭 밑으로 줄어들지 않는다. 좁은 flex 행에 넣지 말고, 클릭하면 팝오버가 뜨는 커스텀 배지 버튼으로 대체할 것.
5. `element.setPointerCapture()`는 해당 pointerId가 이미 종료된 뒤 호출되면 `NotFoundError`를 던진다. 스와이프 처리에서는 항상 `try/catch`로 감쌀 것.
6. 캐러셀 폭을 `width:300%` + 자식 `width:33.3333%`처럼 분수로 계산하면 JS의 `translateX` 계산(부동소수점 전체 자릿수)과 CSS의 고정 소수점 자릿수가 어긋나 화면 경계에 다음 패널이 살짝 비친다. 자식을 `flex:0 0 100%`로 두고 `translateX(-idx*100%)`만 쓰면 이 문제 자체가 생기지 않는다.

## 참고한 외부 레퍼런스
- linear.app, notion, cal.com (Claude/_references/awesome-design-md): 미니멀 유틸리티 톤 참고.
- wwit.design / uibowl.io: 별도 스크린샷 저장 없이 방향만 참고.
