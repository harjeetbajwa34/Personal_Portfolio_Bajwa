import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
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

        if (!messageList) return;

        messageList.innerHTML = "";

        const querySnapshot = await getDocs(
            collection(db, "messages")
        );

        querySnapshot.forEach((docItem) => {

            const data = docItem.data();

            messageList.innerHTML += `
                <div style="margin-bottom:20px; padding:10px; border:1px solid #ccc;">
                    <h3>${data.name}</h3>
                    <p>${data.email}</p>
                    <p>${data.message}</p>

                    <button onclick="editMessage('${docItem.id}', '${data.message}')">
                        Edit
                    </button>

                    <button onclick="deleteMessage('${docItem.id}')">
                        Delete
                    </button>

                    <hr>
                </div>
            `;
        });

    } catch (error) {

        console.error("READ ERROR:", error);
    }
}

window.editMessage = async function(id, currentMessage) {

    const newMessage = prompt(
        "Edit your message:",
        currentMessage
    );

    if (!newMessage) return;

    try {

        const messageRef = doc(
            db,
            "messages",
            id
        );

        await updateDoc(messageRef, {
            message: newMessage
        });

        alert("Message Updated Successfully!");

        loadMessages();

    } catch (error) {

        console.error(error);

        alert("Update Failed");
    }
};

window.deleteMessage = async function(id) {

    const confirmDelete = confirm(
        "Are you sure you want to delete this message?"
    );

    if (!confirmDelete) return;

    try {

        await deleteDoc(
            doc(db, "messages", id)
        );

        alert("Message Deleted Successfully!");

        loadMessages();

    } catch (error) {

        console.error(error);

        alert("Delete Failed");
    }
};

loadMessages();