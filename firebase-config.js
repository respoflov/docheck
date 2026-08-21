// Firebase 프로젝트 설정 자리입니다.
// 1) https://console.firebase.google.com 에서 새 프로젝트를 만듭니다 (무료 Spark 플랜, 카드 등록 불필요).
// 2) 프로젝트 설정 > 일반 > "내 앱" 에서 웹 앱을 추가하면 아래 값들을 그대로 보여줍니다. 복사해서 붙여넣으세요.
// 3) Authentication > Sign-in method 에서 "Google" 로그인을 사용 설정합니다.
// 4) Firestore Database 를 만들고(프로덕션 모드), 규칙(Rules)을 아래처럼 바꿔 본인 데이터만 읽고 쓰게 제한합니다:
//      match /users/{userId} { allow read, write: if request.auth != null && request.auth.uid == userId; }
// 이 값들을 채우지 않아도 앱은 로컬 저장(localStorage)만으로 정상 동작합니다. 동기화만 켜지지 않습니다.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(v => String(v).includes("REPLACE_ME"));
