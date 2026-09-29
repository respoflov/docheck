// Firebase 동기화 모듈. SDK는 동기화를 처음 쓸 때만 CDN에서 불러온다
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

let app = null, auth = null, db = null, GoogleAuthProvider = null, signInWithPopup = null,
    onAuthStateChanged = null, signOut = null, doc = null, setDoc = null, onSnapshot = null, getDoc = null;

// firebase-config.js에 실제 값이 채워졌는지 여부
export const isConfigured = firebaseConfigured;
let sdkLoaded = false;

// Firebase 앱·인증·Firestore SDK를 한 번만 불러와 초기화한다
async function loadSdk(){
  if(sdkLoaded) return;
  const ver = "12.18.0";
  const [{ initializeApp }, authMod, storeMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${ver}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${ver}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${ver}/firebase-firestore.js`)
  ]);
  app = initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  GoogleAuthProvider = authMod.GoogleAuthProvider;
  signInWithPopup = authMod.signInWithPopup;
  onAuthStateChanged = authMod.onAuthStateChanged;
  signOut = authMod.signOut;
  db = storeMod.getFirestore(app);
  doc = storeMod.doc;
  setDoc = storeMod.setDoc;
  getDoc = storeMod.getDoc;
  onSnapshot = storeMod.onSnapshot;
  sdkLoaded = true;
}

export async function signIn(){
  // Google 계정 팝업으로 로그인하고 사용자 정보를 돌려준다
  if(!isConfigured) throw new Error("NOT_CONFIGURED");
  await loadSdk();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// 로그아웃한다
export async function signOutUser(){
  if(!sdkLoaded) return;
  await signOut(auth);
}

// 로그인 상태가 바뀔 때마다 callback을 부른다. 반환값은 구독 해제 함수
export async function watchAuth(callback){
  if(!isConfigured) return function unsub(){};
  await loadSdk();
  return onAuthStateChanged(auth, callback);
}

// 클라우드에 저장된 이 사용자의 상태를 한 번 읽어 온다
export async function pullRemoteState(uid){
  await loadSdk();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().state : null;
}

// 현재 상태를 클라우드(users/사용자 id 문서)에 저장한다
export async function pushState(uid, state){
  if(!sdkLoaded) return;
  await setDoc(doc(db, "users", uid), { state, updatedAt: Date.now() }, { merge: true });
}

// 다른 기기에서 바뀐 클라우드 상태를 실시간으로 받아 callback에 넘긴다
export async function watchRemoteState(uid, callback){
  await loadSdk();
  return onSnapshot(doc(db, "users", uid), function(snap){
    if(snap.exists()) callback(snap.data());
  });
}
