
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { auth, db } from './firebase.js';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

const NAME_MAX = 80;
const MESSAGE_MAX = 1000;
const MIN_PASSWORD = 8;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const setText = (id, text) => {
  $(id).textContent = text;
};

// state: '' | 'error' | 'success' (styled in contact.css)
const setNote = (id, text, state = '') => {
  const note = $(id);
  note.textContent = text;
  note.dataset.state = state;
};

const clearErrors = (formId) => {
  $(formId).querySelectorAll('.error').forEach((item) => {
    item.textContent = ''; // eslint-disable-line no-param-reassign
  });
};

const setBusy = (buttonId, busy, busyLabel) => {
  const button = $(buttonId);
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.toggleAttribute('disabled', busy);
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isStrongPassword = (value) => value.length >= MIN_PASSWORD
  && /[A-Za-z]/.test(value)
  && /\d/.test(value);

const authErrorText = (code) => {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/weak-password': `Password must be at least ${MIN_PASSWORD} characters.`,
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
};

const formatDate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  return timestamp.toDate().toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ---------------------------------------------------------------------------
// reCAPTCHA 
// ---------------------------------------------------------------------------

const captchaWidgets = {};

const loadRecaptcha = () => new Promise((resolve, reject) => {
  window.onRecaptchaLoad = resolve;
  const script = document.createElement('script');
  script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
  script.async = true;
  script.defer = true;
  script.onerror = reject;
  document.head.appendChild(script);
});

const renderCaptchas = () => {
  ['login', 'register'].forEach((key) => {
    captchaWidgets[key] = window.grecaptcha.render(`${key}-captcha`, {
      sitekey: RECAPTCHA_SITE_KEY,
    });
  });
};

const getCaptchaToken = (key) => {
  if (!window.grecaptcha || captchaWidgets[key] === undefined) return '';
  return window.grecaptcha.getResponse(captchaWidgets[key]);
};

const resetCaptcha = (key) => {
  if (window.grecaptcha && captchaWidgets[key] !== undefined) {
    window.grecaptcha.reset(captchaWidgets[key]);
  }
};

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

const state = {
  messages: [],
  unsubscribe: null,
  editing: null, // { id, draft, error }
  pendingDelete: null, // id of the message waiting for a second click
  deleteTimer: null,
};

// ---------------------------------------------------------------------------
// Account UI 
// ---------------------------------------------------------------------------

const showAuthTab = (tab) => {
  const isLogin = tab === 'login';
  $('login-form').hidden = !isLogin;
  $('register-form').hidden = isLogin;
  $('tab-login').setAttribute('aria-selected', String(isLogin));
  $('tab-register').setAttribute('aria-selected', String(!isLogin));
};

const updateAccountUI = (user) => {
  const signedIn = Boolean(user);
  const verified = signedIn && user.emailVerified;

  $('auth-panel').hidden = signedIn;
  $('account-panel').hidden = !signedIn;

  if (signedIn) {
    setText('account-name', user.displayName || 'there');
    setText('account-email', user.email);
    setText('verify-status', verified ? 'Email verified' : 'Email not verified');
    $('verify-status').dataset.state = verified ? 'ok' : 'warn';
    $('verify-actions').hidden = verified;
    setText('account-title', 'Your account');
  } else {
    setText('account-title', 'Log in to leave a message');
  }

  // The contact form only unlocks for verified accounts.
  $('contact-fieldset').toggleAttribute('disabled', !verified);
  $('form-lock').hidden = verified;
  if (!signedIn) {
    setText('form-lock', 'Log in or create an account to send a message.');
  } else if (!verified) {
    setText('form-lock', 'Please verify your email first. Open the link we sent you, then press "I have verified".');
  }

  if (verified) {
    if (!$('name').value) $('name').value = user.displayName || '';
    $('email').value = user.email;
  } else {
    $('contact-form').reset();
  }
};

// ---------------------------------------------------------------------------
// Message list 
// ---------------------------------------------------------------------------

const makeEl = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text; // textContent blocks HTML injection
  return el;
};

const makeButton = (label, action, id, className = 'link-btn') => {
  const button = makeEl('button', className, label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
};

const buildEditor = (item) => {
  const wrap = makeEl('div', 'message-editor');
  const textarea = makeEl('textarea', 'message-edit');
  textarea.id = `edit-${item.id}`;
  textarea.value = state.editing.draft;
  textarea.maxLength = MESSAGE_MAX;
  textarea.setAttribute('aria-label', 'Edit your message');
  textarea.addEventListener('input', () => {
    state.editing.draft = textarea.value;
    setText(`edit-count-${item.id}`, `${textarea.value.length} / ${MESSAGE_MAX}`);
  });

  const count = makeEl('small', 'char-count', `${state.editing.draft.length} / ${MESSAGE_MAX}`);
  count.id = `edit-count-${item.id}`;
  const error = makeEl('small', 'error', state.editing.error || '');

  const actions = makeEl('div', 'message-actions');
  actions.append(
    makeButton('Save changes', 'save', item.id, 'btn btn-small'),
    makeButton('Cancel', 'cancel', item.id),
  );

  wrap.append(textarea, count, error, actions);
  return wrap;
};

const buildCard = (item) => {
  const user = auth.currentUser;
  const isOwner = Boolean(user) && item.uid === user.uid;
  const isEditing = Boolean(state.editing) && state.editing.id === item.id;

  const card = makeEl('li', isOwner ? 'message-card is-own' : 'message-card');

  const head = makeEl('div', 'message-head');
  head.append(makeEl('h3', 'message-name', item.name || 'Anonymous'));
  if (isOwner) head.append(makeEl('span', 'message-tag', 'You'));

  const metaParts = [item.email, formatDate(item.createdAt)].filter(Boolean);
  if (item.updatedAt) metaParts.push('edited');
  const meta = makeEl('p', 'message-meta', metaParts.join(' · '));

  card.append(head, meta);

  if (isEditing) {
    card.append(buildEditor(item));
  } else {
    card.append(makeEl('p', 'message-text', item.message));
  }

  if (isOwner && !isEditing) {
    const actions = makeEl('div', 'message-actions');
    if (state.pendingDelete === item.id) {
      actions.append(
        makeButton('Confirm delete', 'confirm-delete', item.id, 'link-btn is-danger'),
        makeButton('Keep it', 'keep', item.id),
      );
    } else {
      actions.append(
        makeButton('Edit', 'edit', item.id),
        makeButton('Delete', 'delete', item.id, 'link-btn is-danger'),
      );
    }
    card.append(actions);
  }

  return card;
};

const renderMessages = () => {
  const list = $('message-list');
  const editingFocused = state.editing
    && document.activeElement
    && document.activeElement.id === `edit-${state.editing.id}`;

  list.replaceChildren(...state.messages.map(buildCard));

  if (!auth.currentUser) {
    setText('messages-empty', 'Log in to read the messages.');
  } else if (state.messages.length === 0) {
    setText('messages-empty', 'No messages yet. Be the first to say hello.');
  } else {
    setText('messages-empty', '');
  }
  $('messages-empty').hidden = !$('messages-empty').textContent;

  if (editingFocused) {
    const box = $(`edit-${state.editing.id}`);
    if (box) box.focus();
  }
};

const stopMessages = () => {
  if (state.unsubscribe) state.unsubscribe();
  state.unsubscribe = null;
  state.messages = [];
  state.editing = null;
  state.pendingDelete = null;
};

const startMessages = () => {
  const messagesQuery = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  state.unsubscribe = onSnapshot(
    messagesQuery,
    (snapshot) => {
      state.messages = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data({ serverTimestamps: 'estimate' }),
      }));
      setNote('messages-note', '');
      renderMessages();
    },
    (error) => {
      // eslint-disable-next-line no-console
      console.error('Real-time listener error:', error);
      setNote('messages-note', 'Messages could not be loaded. Please refresh the page.', 'error');
    },
  );
};

const saveEdit = async (id) => {
  const draft = state.editing.draft.trim();
  if (!draft) {
    state.editing.error = 'Your message cannot be empty.';
    renderMessages();
    return;
  }
  try {
    await updateDoc(doc(db, 'messages', id), {
      message: draft,
      updatedAt: serverTimestamp(),
    });
    state.editing = null;
    setNote('messages-note', 'Message updated.', 'success');
  } catch (error) {
    state.editing.error = error.code === 'permission-denied'
      ? 'You can only edit your own messages.'
      : 'Update failed. Please try again.';
  }
  renderMessages();
};

const removeMessage = async (id) => {
  try {
    await deleteDoc(doc(db, 'messages', id));
    setNote('messages-note', 'Message deleted.', 'success');
  } catch (error) {
    setNote('messages-note', 'Delete failed. Please try again.', 'error');
  }
  state.pendingDelete = null;
  renderMessages();
};

const handleMessageClick = (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const item = state.messages.find((message) => message.id === id);
  if (!item) return;

  clearTimeout(state.deleteTimer);

  if (action === 'edit') {
    state.editing = { id, draft: item.message, error: '' };
    state.pendingDelete = null;
    renderMessages();
    $(`edit-${id}`).focus();
  } else if (action === 'cancel') {
    state.editing = null;
    renderMessages();
  } else if (action === 'save') {
    saveEdit(id);
  } else if (action === 'delete') {
    state.pendingDelete = id;
    renderMessages();
    // The confirm button goes back to "Delete" after five seconds.
    state.deleteTimer = setTimeout(() => {
      state.pendingDelete = null;
      renderMessages();
    }, 5000);
  } else if (action === 'keep') {
    state.pendingDelete = null;
    renderMessages();
  } else if (action === 'confirm-delete') {
    removeMessage(id);
  }
};

// ---------------------------------------------------------------------------
// Form handlers
// ---------------------------------------------------------------------------

const handleRegister = async (event) => {
  event.preventDefault();
  clearErrors('register-form');
  setNote('register-note', '');

  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;
  const confirmPassword = $('reg-confirm').value;
  let valid = true;

  if (!name || name.length > NAME_MAX) {
    setText('reg-name-error', 'Please enter your name.');
    valid = false;
  }
  if (!isEmail(email)) {
    setText('reg-email-error', 'Please enter a valid email address.');
    valid = false;
  }
  if (!isStrongPassword(password)) {
    setText('reg-password-error', `Use at least ${MIN_PASSWORD} characters with a letter and a number.`);
    valid = false;
  }
  if (password !== confirmPassword) {
    setText('reg-confirm-error', 'Passwords do not match.');
    valid = false;
  }
  if (!getCaptchaToken('register')) {
    setText('register-captcha-error', 'Please tick "I\'m not a robot".');
    valid = false;
  }
  if (!valid) return;

  setBusy('register-btn', true, 'Creating account...');
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await sendEmailVerification(user);
    $('register-form').reset();
    updateAccountUI(auth.currentUser);
    setNote('account-note', `Account created. We sent a verification link to ${email}. Check your inbox (and spam folder).`, 'success');
  } catch (error) {
    setNote('register-note', authErrorText(error.code), 'error');
  } finally {
    resetCaptcha('register');
    setBusy('register-btn', false);
  }
};

const handleLogin = async (event) => {
  event.preventDefault();
  clearErrors('login-form');
  setNote('login-note', '');

  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  let valid = true;

  if (!isEmail(email)) {
    setText('login-email-error', 'Please enter a valid email address.');
    valid = false;
  }
  if (!password) {
    setText('login-password-error', 'Please enter your password.');
    valid = false;
  }
  if (!getCaptchaToken('login')) {
    setText('login-captcha-error', 'Please tick "I\'m not a robot".');
    valid = false;
  }
  if (!valid) return;

  setBusy('login-btn', true, 'Logging in...');
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    $('login-form').reset();
    setNote(
      'account-note',
      user.emailVerified ? 'Welcome back.' : 'You are logged in, but your email is not verified yet.',
      user.emailVerified ? 'success' : 'error',
    );
  } catch (error) {
    setNote('login-note', authErrorText(error.code), 'error');
  } finally {
    resetCaptcha('login');
    setBusy('login-btn', false);
  }
};

const handleForgotPassword = async () => {
  clearErrors('login-form');
  const email = $('login-email').value.trim();
  if (!isEmail(email)) {
    setText('login-email-error', 'Type your email above first, then press "Forgot password?".');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error.code === 'auth/too-many-requests') {
      setNote('login-note', authErrorText(error.code), 'error');
      return;
    }
  }
  // Same message either way, so the form does not reveal which emails have accounts.
  setNote('login-note', 'If an account exists for that email, a reset link is on its way.', 'success');
};

const handleResend = async () => {
  try {
    await sendEmailVerification(auth.currentUser);
    setNote('account-note', `Verification email sent again to ${auth.currentUser.email}.`, 'success');
  } catch (error) {
    setNote('account-note', authErrorText(error.code), 'error');
  }
};

const handleRefresh = async () => {
  try {
    await auth.currentUser.reload();
    // Refresh the ID token so Firestore rules see email_verified = true.
    await auth.currentUser.getIdToken(true);
  } catch (error) {
    setNote('account-note', authErrorText(error.code), 'error');
    return;
  }
  updateAccountUI(auth.currentUser);
  setNote(
    'account-note',
    auth.currentUser.emailVerified
      ? 'Thanks, your email is verified. You can send messages now.'
      : 'Not verified yet. Open the link in the email, then try again.',
    auth.currentUser.emailVerified ? 'success' : 'error',
  );
};

const handleContact = async (event) => {
  event.preventDefault();
  clearErrors('contact-form');
  setNote('form-note', '');

  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    setNote('form-note', 'Please log in with a verified email first.', 'error');
    return;
  }

  const name = $('name').value.trim();
  const message = $('message').value.trim();
  let valid = true;

  if (!name || name.length > NAME_MAX) {
    setText('name-error', 'Please enter your name.');
    valid = false;
  }
  if (!message) {
    setText('message-error', 'Please write a message.');
    valid = false;
  }
  if (!valid) return;

  setBusy('send-btn', true, 'Sending...');
  try {
    await addDoc(collection(db, 'messages'), {
      uid: user.uid,
      name,
      email: user.email,
      message,
      createdAt: serverTimestamp(),
    });
    $('message').value = '';
    setText('message-count', `0 / ${MESSAGE_MAX}`);
    setNote('form-note', 'Thanks, your message has been sent. I will reply as soon as I can.', 'success');
  } catch (error) {
    setNote('form-note', 'Your message could not be sent. Please try again.', 'error');
  } finally {
    setBusy('send-btn', false);
  }
};

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------

setText('year', String(new Date().getFullYear()));

$('tab-login').addEventListener('click', () => showAuthTab('login'));
$('tab-register').addEventListener('click', () => showAuthTab('register'));
$('register-form').addEventListener('submit', handleRegister);
$('login-form').addEventListener('submit', handleLogin);
$('forgot-btn').addEventListener('click', handleForgotPassword);
$('resend-btn').addEventListener('click', handleResend);
$('refresh-btn').addEventListener('click', handleRefresh);
$('logout-btn').addEventListener('click', async () => {
  await signOut(auth);
  setNote('account-note', '');
  setNote('form-note', '');
  setNote('messages-note', '');
  showAuthTab('login');
});
$('contact-form').addEventListener('submit', handleContact);
$('message-list').addEventListener('click', handleMessageClick);
$('message').addEventListener('input', () => {
  setText('message-count', `${$('message').value.length} / ${MESSAGE_MAX}`);
});

loadRecaptcha()
  .then(renderCaptchas)
  .catch(() => {
    setNote('login-note', 'The security check could not load. Check your connection and refresh.', 'error');
  });

onAuthStateChanged(auth, (user) => {
  stopMessages();
  updateAccountUI(user);
  if (user) startMessages();
  renderMessages();
});