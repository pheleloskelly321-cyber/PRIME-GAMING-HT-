import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Konfigirasyon Firebase
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

// Inisyalize EmailJS ak Public Key ou a
emailjs.init("81JFBrIYN8rVOGaql");

let generatedOTP = null;
let isRegisterMode = false;

// FONKSYON AUTH AK OTP
window.handleAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (isRegisterMode && !generatedOTP) {
        generatedOTP = Math.floor(100000 + Math.random() * 900000);
        
        // Voye email via EmailJS (Service ID ou a)
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

// JESTYON ESCROW LÈ YON MOUN LAGE DEFI
window.creerChallenge = async (montan, jwet) => {
    const user = auth.currentUser;
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    const balance = snap.val().balance;

    if (balance >= montan) {
        // 1. Jele kòb la nan balans jwè a
        await update(userRef, { balance: balance - montan });
        
        // 2. Kreye Challenge la
        const newKey = push(ref(db, 'challenges')).key;
        await set(ref(db, `challenges/${newKey}`), {
            creator_id: user.uid,
            creator_name: snap.val().username,
            bet_amount: montan,
            game: jwet,
            status: "open",
            timestamp: Date.now()
        });

        // 3. Mete nan seksyon Escrow pou sekirite
        await set(ref(db, `escrow/${newKey}`), {
            total_amount: montan,
            creator_funds: montan,
            opponent_funds: 0,
            status: "held"
        });
        alert("Defi lage ak siksè! Kòb ou nan Escrow kounye a.");
    } else {
        alert("Balans ou twò piti!");
    }
};
