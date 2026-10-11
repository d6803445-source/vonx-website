// ============================================
// НАСТРОЙКА FIREBASE (обязательно!)
// 1. Зайди на https://console.firebase.google.com
// 2. Создай проект "vonx-launcher"
// 3. Добавь Web-приложение
// 4. Включи Authentication → Google
// 5. Создай Firestore Database (test mode)
// 6. Создай Storage
// 7. Вставь сюда свои ключи:
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyDArv9WUb8GdpGJe1ZqYiswIHaK6abL2dQ",
  authDomain: "vonx-launcher.firebaseapp.com",
  projectId: "vonx-launcher",
  storageBucket: "vonx-launcher.firebasestorage.app",
  messagingSenderId: "147713435344",
  appId: "1:147713435344:web:2122b3b6fa355b8fb120d5"
};

// Главный админ (твой email)
const SUPER_ADMIN_EMAIL = "d6803445@gmail.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
