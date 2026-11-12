// ==========================================================================
//   Лабораторна робота №6. Форма надсилається на власний Node.js-сервер
// ==========================================================================

// --- Налаштування (змініть під себе) --------------------------------------
const VARIANT = 25; // номер варіанта = порядковий номер у журналі групи
const CONTACT_API = '/api/contact'; // відносна адреса: працює і через localhost, і через IP у мережі
const MODAL_DELAY_MS = 60 * 1000; // 1 хвилина

// JSONPlaceholder повертає текст лише латиною (lorem ipsum), тому для кожного
// отриманого коментаря за його id підставляємо український текст відгуку.
// Якщо перекладу для id немає, показується оригінальний текст із сервера.
const REVIEWS_UK = {
  121: {
    name: 'Відповідальний та уважний до деталей',
    body: 'Максим швидко розібрався у вимогах проєкту та виконав завдання раніше встановленого терміну. Код був охайним і добре задокументованим. Рекомендую його як надійного розробника.',
  },
  122: {
    name: 'Чудово працює в команді',
    body: 'Під час хакатону Максим узяв на себе фронтенд і допомагав колегам розібратися з React. Завжди відкритий до порад і зворотного зв’язку. Приємно було працювати разом.',
  },
  123: {
    name: 'Швидко навчається новому',
    body: 'За кілька тижнів освоїв Git та Docker і почав самостійно налаштовувати середовище. Не боїться складних завдань.',
  },
  124: {
    name: 'Ініціативний та організований',
    body: 'Максим сам пропонував покращення інтерфейсу і вчасно повідомляв про хід роботи. Завдання завжди виконувались у строк. Людина, на яку можна покластися.',
  },
  125: {
    name: 'Гарні знання JavaScript',
    body: 'Впевнено працює з асинхронним кодом і API, розуміє принципи компонентного підходу. Добре пояснює свої технічні рішення. Буду радий співпрацювати знову.',
  },
};

// --------------------------------------------------------------------------
// 1. Зберігання даних у браузері (localStorage)
// --------------------------------------------------------------------------
function saveSystemInfo() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages ? navigator.languages.join(', ') : '',
    cookieEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screen: `${screen.width}×${screen.height}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    savedAt: new Date().toLocaleString('uk-UA'),
  };
  // localStorage зберігає лише рядки, тому об'єкт перетворюємо на JSON
  localStorage.setItem('systemInfo', JSON.stringify(info));
}

function renderLocalStorage() {
  const list = document.getElementById('storage-list');
  list.innerHTML = '';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const raw = localStorage.getItem(key);

    // Якщо значення — JSON-об'єкт, показуємо кожне поле окремо
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (parsed !== null && typeof parsed === 'object') {
      for (const [field, value] of Object.entries(parsed)) {
        addStorageRow(list, `${key}.${field}`, value);
      }
    } else {
      addStorageRow(list, key, raw);
    }
  }

  if (localStorage.length === 0) {
    addStorageRow(list, '—', 'localStorage порожній');
  }
}

function addStorageRow(list, key, value) {
  const dt = document.createElement('dt');
  dt.textContent = key;
  const dd = document.createElement('dd');
  dd.textContent = String(value);
  list.append(dt, dd);
}

// --------------------------------------------------------------------------
// 2. Динамічний вміст із сервера (Fetch API + async/await)
// --------------------------------------------------------------------------
async function loadReviews() {
  const container = document.getElementById('reviews-list');
  const status = document.getElementById('reviews-status');

  try {
    const response = await fetch(
      `https://jsonplaceholder.typicode.com/posts/${VARIANT}/comments`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const comments = await response.json();

    status.remove();
    // Відображаємо коментарі у порядку їх отримання
    comments.forEach((comment) => {
      const uk = REVIEWS_UK[comment.id] || {};
      const card = document.createElement('article');
      card.className = 'card review';

      const title = document.createElement('h3');
      title.className = 'card__title';
      title.textContent = uk.name || comment.name;

      const email = document.createElement('a');
      email.className = 'review__email';
      email.href = `mailto:${comment.email}`;
      email.textContent = comment.email;

      const body = document.createElement('p');
      body.className = 'review__body';
      body.textContent = uk.body || comment.body;

      card.append(title, email, body);
      container.append(card);
    });
  } catch (error) {
    console.error('Помилка завантаження відгуків:', error);
    status.textContent = 'Не вдалося завантажити відгуки. Спробуйте пізніше.';
  }
}

// ---------------------------------------------------------------------------
// Надсилання форми зворотного зв'язку на власний сервер (POST /api/contact)
// ---------------------------------------------------------------------------
function setupContactForm() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const submitButton = form.querySelector('button[type="submit"]');

  const showStatus = (text, ok) => {
    status.textContent = text;
    status.classList.toggle('form__status--ok', ok);
    status.classList.toggle('form__status--error', !ok);
    status.hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      subject: formData.get('subject'),
      message: formData.get('message'),
    };

    submitButton.disabled = true;
    try {
      const response = await fetch(CONTACT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.ok) {
        showStatus(`Дякуємо! ${result.message} (id: ${result.id})`, true);
        form.reset(); // очищуємо форму лише після успішної відповіді
      } else {
        showStatus(`Помилка ${response.status}: ${result.error || 'не вдалося надіслати форму.'}`, false);
      }
    } catch (error) {
      console.error('Помилка мережі:', error);
      showStatus('Не вдалося зв\'язатися із сервером. Перевірте, чи він запущений.', false);
    } finally {
      submitButton.disabled = false;
    }
  });
}

// --------------------------------------------------------------------------
// 3. Модальне вікно з формою зворотного зв'язку
// --------------------------------------------------------------------------
function setupContactModal() {
  const modal = document.getElementById('contact-modal');
  const form = document.getElementById('contact-form');
  const closeButton = document.getElementById('modal-close');

  const showModal = () => {
    modal.hidden = false;
    document.getElementById('contact-name').focus();
  };

  // Автоматичне відкриття: не показуємо повторно, якщо вікно вже закривали в цій сесії
  const openModal = () => {
    if (sessionStorage.getItem('contactModalClosed') === 'true') return;
    showModal();
  };

  // Відкриття вручну кнопкою — працює завжди
  document.getElementById('open-contact').addEventListener('click', showModal);

  const closeModal = () => {
    modal.hidden = true;
    sessionStorage.setItem('contactModalClosed', 'true');
  };

  closeButton.addEventListener('click', closeModal);

  // Закриття кліком по затемненому фону
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  // Закриття клавішею Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  setTimeout(openModal, MODAL_DELAY_MS);
}

// --------------------------------------------------------------------------
// 4. Денний / нічний режим
// --------------------------------------------------------------------------
function getThemeByTime() {
  const hours = new Date().getHours(); // 0–23
  // Денна тема: з 07:00 до 21:00, нічна — увесь інший час
  return hours >= 7 && hours < 21 ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  const button = document.getElementById('theme-toggle');
  button.textContent = theme === 'dark' ? '☀️ Денний режим' : '🌙 Нічний режим';
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

function setupThemeToggle() {
  let theme = getThemeByTime();
  applyTheme(theme);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
  });
}

// --------------------------------------------------------------------------
// Запуск після завантаження DOM
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  saveSystemInfo();
  renderLocalStorage();
  loadReviews();
  setupContactModal();
  setupContactForm();
});
