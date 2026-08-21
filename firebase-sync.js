import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

let app = null, auth = null, db = null, GoogleAuthProvider = null, signInWithPopup = null,
    onAuthStateChanged = null, signOut = null, doc = null, setDoc = null, onSnapshot = null, getDoc = null;

export const isConfigured = firebaseConfigured;
let sdkLoaded = false;

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
  if(!isConfigured) throw new Error("NOT_CONFIGURED");
  await loadSdk();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(){
  if(!sdkLoaded) return;
  await signOut(auth);
}

export async function watchAuth(callback){
  if(!isConfigured) return function unsub(){};
  await loadSdk();
  return onAuthStateChanged(auth, callback);
}

export async function pullRemoteState(uid){
  await loadSdk();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().state : null;
}

export async function pushState(uid, state){
  if(!sdkLoaded) return;
  await setDoc(doc(db, "users", uid), { state, updatedAt: Date.now() }, { merge: true });
}

export async function watchRemoteState(uid, callback){
  await loadSdk();
  return onSnapshot(doc(db, "users", uid), function(snap){
    if(snap.exists()) callback(snap.data());
  });
}
