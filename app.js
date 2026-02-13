import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Konfigirasyon Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCHVG_0BCd0V_lFSmg3_2qyC5rKclG-b0M",
    authDomain: "prime-gaming-ht.firebaseapp.com",
    databaseURL: "https://prime-gaming-ht-default-rtdb.firebaseio.com",
    projectId: "prime-gaming-ht",
    storageBucket: "prime-gaming-ht.firebasestorage.app",
    appId: "1:579566074161:web:e50abea764dd4d37371810"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Inisyalize EmailJS
emailjs.init("81JFBrIYN8rVOGaql");

let generatedOTP = null;
let isRegisterMode = false;

// --- FONKSYON AUTH AK OTP ---
window.handleAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (isRegisterMode && !generatedOTP) {
        generatedOTP = Math.floor(100000 + Math.random() * 900000);
        emailjs.send("service_8die49b", "template_otp", {
            to_email: email,
            otp_code: generatedOTP,
            from_name: "PRIME GAMING HT"
        }).then(() => {
            document.getElementById('otp-section').classList.remove('hidden');
            document.getElementById('main-btn').innerText = "KONFIME KÒD LA";
            alert("Vire gad email ou!");
        }).catch(err => alert("Erè SMTP: " + err));
        return;
    }

    if (isRegisterMode && generatedOTP) {
        const inputOTP = document.getElementById('otp-input').value;
        if (inputOTP != generatedOTP) return alert("Kòd la pa bon!");
        try {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await set(ref(db, `users/${res.user.uid}`), {
                username: email.split('@')[0],
                balance: 0,
                role: "player",
                email: email,
                created_at: Date.now()
            });
            window.location.href = "index.html";
        } catch (e) { alert(e.message); }
    } else {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            window.location.href = "index.html";
        } catch (e) { alert("Email oswa Modpas enkòrèk!"); }
    }
};

window.toggleAuth = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('main-btn').innerText = isRegisterMode ? "VÈRIFYE EMAIL" : "KONEKTE";
    document.getElementById('otp-section').classList.add('hidden');
    generatedOTP = null;
};

window.logout = () => signOut(auth).then(() => window.location.href = "login.html");

// --- JESTYON ESCROW & DEFI (ITILIZATÈ) ---
window.creerChallenge = async (montan, jwet) => {
    const user = auth.currentUser;
    if (!user) return alert("Konekte avan!");
    
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    const balance = snap.val().balance;

    if (balance >= montan) {
        await update(userRef, { balance: balance - montan });
        const newKey = push(ref(db, 'challenges')).key;
        await set(ref(db, `challenges/${newKey}`), {
            creator_id: user.uid,
            creator_name: snap.val().username,
            bet_amount: montan,
            game: jwet,
            status: "open",
            timestamp: Date.now()
        });
        await set(ref(db, `escrow/${newKey}`), {
            total_amount: montan,
            creator_funds: montan,
            status: "held"
        });
        alert("Defi lage!");
    } else { alert("Balans ou twò piti!"); }
};

// --- 🔴 LOJIK ADMIN (Sèlman si w sou admin.html) ---
if (window.location.pathname.includes("admin.html")) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.val().role !== "admin") {
            alert("Ou pa gen aksè Admin!");
            window.location.href = "index.html";
            return;
        }

        // Chaje Depo Pending
        onValue(ref(db, 'transactions'), (snapshot) => {
            const list = document.getElementById('admin-deposits');
            if (!list) return;
            list.innerHTML = "";
            snapshot.forEach((child) => {
                const t = child.val();
                if (t.status === "pending" && t.type === "deposit") {
                    list.innerHTML += `
                        <div class="bg-gray-900 p-3 rounded mb-2 flex justify-between">
                            <span>${t.amount} HTG (${t.method}) - Ref: ${t.reference_code}</span>
                            <button onclick="approveDeposit('${child.key}', '${t.user_id}', ${t.amount})" class="bg-green-600 px-2 py-1 rounded text-xs">Approve</button>
                        </div>`;
                }
            });
        });

        // Chaje Defi pou lage kòb
        onValue(ref(db, 'challenges'), (snapshot) => {
            const list = document.getElementById('admin-challenges');
            if (!list) return;
            list.innerHTML = "";
            snapshot.forEach((child) => {
                const c = child.val();
                if (c.status === "completed_waiting_admin") {
                    list.innerHTML += `
                        <div class="bg-gray-900 p-3 rounded mb-2">
                            <p>${c.game} (${c.bet_amount * 2} HTG Pot)</p>
                            <div class="flex gap-2 mt-2">
                                <button onclick="releaseEscrow('${child.key}', '${c.creator_id}', ${c.bet_amount})" class="bg-blue-600 text-[10px] p-1 rounded">Jwè 1 Gayan</button>
                                <button onclick="releaseEscrow('${child.key}', '${c.opponent_id}', ${c.bet_amount})" class="bg-purple-600 text-[10px] p-1 rounded">Jwè 2 Gayan</button>
                            </div>
                        </div>`;
                }
            });
        });
    });
}

// --- FONKSYON AKSYON ADMIN ---
window.approveDeposit = async (id, uid, amt) => {
    const uRef = ref(db, `users/${uid}`);
    const uSnap = await get(uRef);
    await update(uRef, { balance: (uSnap.val().balance || 0) + amt });
    await update(ref(db, `transactions/${id}`), { status: "approved" });
    alert("Kòb la ajoute!");
};

window.releaseEscrow = async (cid, winUid, amt) => {
    const finalAmt = (amt * 2) * 0.90; // 10% frè platfòm
    const wRef = ref(db, `users/${winUid}`);
    const wSnap = await get(wRef);
    await update(wRef, { balance: (wSnap.val().balance || 0) + finalAmt });
    await update(ref(db, `challenges/${cid}`), { status: "closed" });
    await remove(ref(db, `escrow/${cid}`));
    alert("Kòb lage!");
};
