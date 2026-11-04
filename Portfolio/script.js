/* =========================================================
   script.js — shared by all four pages
   Harjeet Bajwa — personal portfolio

   Pages: home.html, skills.html, projects.html, contact.html

   Jobs:
     1. highlight the current page in the menu
     2. show the current year in the footer
     3. open project diagrams in a lightbox
     4. run the contact form: check it, save it, show it
   ========================================================= */


/* ---------------------------------------------------------
   SETTINGS
   To receive messages by email as well, make a free form at
   formspree.io, copy the address it gives you, and paste it
   between the quotes below. Leave it empty and the form just
   saves messages on the page.
   --------------------------------------------------------- */
var FORMSPREE_URL = "";          // e.g. "https://formspree.io/f/abcdwxyz"
var MY_EMAIL = "harjeetchhapa34@gmail.com";
var STORAGE_KEY = "portfolio-messages";


/* Wait until the page has loaded, otherwise the elements
   below do not exist yet. */
document.addEventListener("DOMContentLoaded", function () {
  highlightCurrentPage();
  showCurrentYear();
  setUpLightbox();
  setUpContactForm();
});


/* ---------------------------------------------------------
   1. Highlight the current page in the menu
   Reads the file name from the address bar and adds the
   is-current class to the matching link, so I do not have to
   set it by hand in each HTML file.
   --------------------------------------------------------- */
function highlightCurrentPage() {
  // "/portfolio/skills.html" -> "skills.html"
  var page = window.location.pathname.split("/").pop();

  // opening the folder itself gives an empty name
  if (page === "") {
    page = "home.html";
  }

  var links = document.querySelectorAll(".nav a");

  links.forEach(function (link) {
    if (link.getAttribute("href") === page) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("is-current");
      link.removeAttribute("aria-current");
    }
  });
}


/* ---------------------------------------------------------
   2. Show the current year in the footer
   Keeps the copyright line from going out of date.
   --------------------------------------------------------- */
function showCurrentYear() {
  var yearSpan = document.getElementById("year");

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
}


/* ---------------------------------------------------------
   3. Lightbox for the project diagrams
   Clicking a diagram opens it large on top of the page.
   Escape, the close button, or a click outside shuts it.
   --------------------------------------------------------- */
function setUpLightbox() {
  var projectLinks = document.querySelectorAll(".project-link");

  // nothing to do on pages without diagrams
  if (projectLinks.length === 0) {
    return;
  }

  // build the lightbox once and reuse it for every image
  var box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close">&times;</button>' +
    '<img src="" alt="">';
  document.body.appendChild(box);

  var boxImage = box.querySelector("img");
  var closeButton = box.querySelector(".lightbox-close");

  function openBox(src, alt) {
    boxImage.setAttribute("src", src);
    boxImage.setAttribute("alt", alt);
    box.classList.add("is-open");
    closeButton.focus();
  }

  function closeBox() {
    box.classList.remove("is-open");
    boxImage.setAttribute("src", "");
  }

  projectLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();           // stop a new tab opening
      var image = link.querySelector("img");
      openBox(link.getAttribute("href"), image.getAttribute("alt"));
    });
  });

  closeButton.addEventListener("click", closeBox);

  // clicking the dark area around the image closes it too
  box.addEventListener("click", function (event) {
    if (event.target === box) {
      closeBox();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeBox();
    }
  });
}


/* ---------------------------------------------------------
   4. Contact form and messages
   Checks the three fields, saves the message, and shows it
   in the Messages list under the form.
   --------------------------------------------------------- */
function setUpContactForm() {
  var form = document.getElementById("contact-form");

  // nothing to do on the other three pages
  if (!form) {
    return;
  }

  var nameField = document.getElementById("name");
  var emailField = document.getElementById("email");
  var messageField = document.getElementById("message");
  var note = document.getElementById("form-note");

  var list = document.getElementById("message-list");
  var emptyNote = document.getElementById("messages-empty");
  var clearButton = document.getElementById("clear-messages");

  // show anything saved from an earlier visit
  drawMessages();

  form.addEventListener("submit", function (event) {
    event.preventDefault();             // handle it here, not by the browser

    clearErrors();

    var name = nameField.value.trim();
    var email = emailField.value.trim();
    var text = messageField.value.trim();
    var isValid = true;

    if (name === "") {
      showError(nameField, "name-error", "Please enter your name.");
      isValid = false;
    }

    if (email === "") {
      showError(emailField, "email-error", "Please enter your email address.");
      isValid = false;
    } else if (!isEmail(email)) {
      showError(emailField, "email-error", "That does not look like an email address.");
      isValid = false;
    }

    if (text === "") {
      showError(messageField, "message-error", "Please write a message.");
      isValid = false;
    }

    if (!isValid) {
      return;                           // visitor fixes the fields first
    }

    // save it and put it on the page straight away
    saveMessage({
      name: name,
      email: email,
      text: text,
      date: new Date().toISOString()
    });

    drawMessages();
    form.reset();

    // send it on as well, if a form address has been set
    if (FORMSPREE_URL !== "") {
      sendToFormspree(name, email, text);
    } else {
      setNote("Thanks " + name + ", your message has been added below.", true);
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (window.confirm("Delete all messages?")) {
        writeMessages([]);
        drawMessages();
        setNote("All messages deleted.", false);
      }
    });
  }


  /* ---- sending ---- */

  function sendToFormspree(name, email, text) {
    setNote("Sending your message...", false);

    fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: new URLSearchParams({ name: name, email: email, message: text })
    })
      .then(function (response) {
        if (response.ok) {
          setNote("Thanks " + name + ", your message has been sent.", true);
        } else {
          setNote("Your message was saved below, but sending failed. Please email " + MY_EMAIL + ".", false);
        }
      })
      .catch(function () {
        setNote("Your message was saved below, but sending failed. Please email " + MY_EMAIL + ".", false);
      });
  }


  /* ---- storing ---- */

  // localStorage can be switched off, so every use is guarded

  function readMessages() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  }

  function writeMessages(messages) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      // storage unavailable: the message still shows until the page reloads
    }
  }

  function saveMessage(message) {
    var messages = readMessages();
    messages.unshift(message);          // newest first
    writeMessages(messages);
  }

  function deleteMessage(index) {
    var messages = readMessages();
    messages.splice(index, 1);
    writeMessages(messages);
    drawMessages();
  }


  /* ---- showing ---- */

  function drawMessages() {
    var messages = readMessages();

    list.innerHTML = "";

    if (messages.length === 0) {
      emptyNote.hidden = false;
      clearButton.hidden = true;
      return;
    }

    emptyNote.hidden = true;
    clearButton.hidden = false;

    messages.forEach(function (message, index) {
      list.appendChild(buildMessage(message, index));
    });
  }

  function buildMessage(message, index) {
    var item = document.createElement("li");
    item.className = "message";

    var head = document.createElement("div");
    head.className = "message-head";

    var who = document.createElement("p");
    who.className = "message-who";
    who.textContent = message.name;     // textContent, so typed HTML cannot run

    var when = document.createElement("p");
    when.className = "message-when";
    when.textContent = formatDate(message.date);

    var remove = document.createElement("button");
    remove.className = "link-btn";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", "Delete the message from " + message.name);
    remove.addEventListener("click", function () {
      deleteMessage(index);
    });

    var body = document.createElement("p");
    body.className = "message-text";
    body.textContent = message.text;

    head.appendChild(who);
    head.appendChild(when);
    head.appendChild(remove);
    item.appendChild(head);
    item.appendChild(body);

    return item;
  }

  function formatDate(value) {
    var date = new Date(value);

    if (isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }) + ", " + date.toLocaleTimeString("en-NZ", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  /* ---- small helpers ---- */

  function isEmail(value) {
    // something, then @, then something, then a dot, then something
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setNote(text, isSuccess) {
    note.textContent = text;
    note.classList.toggle("is-success", isSuccess === true);
  }

  function showError(field, errorId, text) {
    field.classList.add("is-invalid");
    document.getElementById(errorId).textContent = text;
  }

  function clearErrors() {
    [nameField, emailField, messageField].forEach(function (field) {
      field.classList.remove("is-invalid");
    });

    form.querySelectorAll(".error").forEach(function (error) {
      error.textContent = "";
    });

    note.classList.remove("is-success");
  }
}