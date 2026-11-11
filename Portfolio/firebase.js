import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDH1uk_oVqqWCtVH-DUvJJ1UrCj6yJ-AzA",
    authDomain: "myportfolioassessment.firebaseapp.com",
    databaseURL: "https://myportfolioassessment-default-rtdb.firebaseio.com",
    projectId: "myportfolioassessment",
    storageBucket: "myportfolioassessment.firebasestorage.app",
    messagingSenderId: "998044600222",
    appId: "1:998044600222:web:42dce1debac15309ec388f",
    measurementId: "G-GM4L6N6D5M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase Connected Successfully");

const form = document.getElementById("contact-form");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const message = document.getElementById("message").value;

    try {

        await addDoc(collection(db, "messages"), {
            name: name,
            email: email,
            message: message
        });

        alert("Message sent successfully!");

        loadMessages();

        form.reset();

    } catch (error) {

        console.error(error);

        alert("Error sending message.");
    }
});

async function loadMessages() {

    try {

        const messageList = document.getElementById("messageList");

        if (!messageList) {
            console.log("messageList div not found");
            return;
        }

        messageList.innerHTML = "";

        const querySnapshot = await getDocs(
            collection(db, "messages")
        );

        querySnapshot.forEach((doc) => {

            const data = doc.data();

            messageList.innerHTML += `
                <div style="margin-bottom:20px;">
                    <h3>${data.name}</h3>
                    <p>${data.email}</p>
                    <p>${data.message}</p>
                    <hr>
                </div>
            `;
        });

    } catch (error) {

        console.error("READ ERROR:", error);
    }
}

loadMessages();