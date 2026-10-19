const STORAGE_KEY = 'pixelNestAlbum';
const DEFAULT_CATEGORIES = [
  'Paisaje',
  'Retrato',
  'Arquitectura',
  'Naturaleza',
  'Personas',
  'Eventos',
  'Producto',
  'Otros'
];

const elements = {
  storageStat: document.getElementById('storageStat'),
  cameraPreview: document.getElementById('cameraPreview'),
  cameraOverlay: document.getElementById('cameraOverlay'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  captureBtn: document.getElementById('captureBtn'),
  switchCameraBtn: document.getElementById('switchCameraBtn'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  photoForm: document.getElementById('photoForm'),
  photoPreviewBox: document.getElementById('photoPreviewBox'),
  photoPreview: document.getElementById('photoPreview'),
  titleInput: document.getElementById('titleInput'),
  authorInput: document.getElementById('authorInput'),
  categoryInput: document.getElementById('categoryInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  clearFormBtn: document.getElementById('clearFormBtn'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  categoryChips: document.getElementById('categoryChips'),
  galleryGrid: document.getElementById('galleryGrid'),
  emptyState: document.getElementById('emptyState'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalAuthor: document.getElementById('modalAuthor'),
  modalCategory: document.getElementById('modalCategory'),
  modalDate: document.getElementById('modalDate'),
  modalDescription: document.getElementById('modalDescription'),
  modalImage: document.getElementById('modalImage'),
  downloadLink: document.getElementById('downloadLink'),
  deletePhotoBtn: document.getElementById('deletePhotoBtn'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

let album = loadAlbum();
let pendingPhoto = '';
let stream = null;
let facingMode = 'environment';
let selectedPhotoId = null;

window.addEventListener('DOMContentLoaded', () => {
  populateCategoryOptions();
  bindEvents();
  renderCategoryChips();
  renderGallery();
  updateStorageStat();
});

function bindEvents() {
  elements.startCameraBtn.addEventListener('click', startCamera);
  elements.switchCameraBtn.addEventListener('click', switchCamera);
  elements.captureBtn.addEventListener('click', captureFromCamera);

  elements.browseBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (event) => {
    handleSelectedFiles(event.target.files);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove('is-dragging');
    });
  });

  elements.dropZone.addEventListener('drop', (event) => {
    handleSelectedFiles(event.dataTransfer.files);
  });

  elements.photoForm.addEventListener('submit', savePhoto);
  elements.clearFormBtn.addEventListener('click', resetForm);

  elements.searchInput.addEventListener('input', renderGallery);
  elements.categoryFilter.addEventListener('change', () => {
    renderGallery();
    renderCategoryChips();
  });

  elements.galleryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.photo-card');
    if (!card) return;
    openModal(card.dataset.id);
  });

  elements.closeModalBtn.addEventListener('click', closeModal);

  elements.modal.addEventListener('click', (event) => {
    if (event.target.dataset.close === 'true') {
      closeModal();
    }
  });

  elements.deletePhotoBtn.addEventListener('click', () => {
    if (!selectedPhotoId) return;

    album = album.filter((item) => item.id !== selectedPhotoId);
    saveAlbum();
    renderGallery();
    closeModal();
  });

  elements.downloadLink.addEventListener('click', (event) => {
    const item = album.find((entry) => entry.id === selectedPhotoId);
    if (!item) {
      event.preventDefault();
      return;
    }

    const safeName = slugify(item.title || 'foto');
    elements.downloadLink.download = `${safeName}.jpg`;
  });
}

function populateCategoryOptions() {
  const allCategories = getAllCategories();
  const options = allCategories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join('');

  elements.categoryFilter.innerHTML = `<option value="Todas">Todas las categorías</option>${options}`;
  elements.categoryFilter.value = 'Todas';
}

function renderCategoryChips() {
  const allCategories = getAllCategories();
  const activeCategory = elements.categoryFilter.value || 'Todas';

  const chips = [
    `<button type="button" class="category-chip ${activeCategory === 'Todas' ? 'active' : ''}" data-category="Todas">Todas</button>`
  ];

  allCategories.forEach((category) => {
    chips.push(
      `<button type="button" class="category-chip ${activeCategory === category ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    );
  });

  elements.categoryChips.innerHTML = chips.join('');

  elements.categoryChips.querySelectorAll('.category-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedCategory = button.dataset.category;
      elements.categoryFilter.value = selectedCategory;
      renderGallery();
      renderCategoryChips();
    });
  });
}

function getAllCategories() {
  const existing = album.map((item) => item.category);
  const merged = [...DEFAULT_CATEGORIES, ...existing];
  return [...new Set(merged)];
}

function loadAlbum() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('No se pudo cargar el álbum:', error);
    return [];
  }
}

function saveAlbum() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(album));
  updateStorageStat();
}

function updateStorageStat() {
  const total = album.length;
  elements.storageStat.textContent = `${total} ${total === 1 ? 'foto' : 'fotos'}`;
}

function handleSelectedFiles(files) {
  if (!files || !files.length) return;

  const file = Array.from(files).find((item) => item.type.startsWith('image/'));
  if (!file) {
    alert('Selecciona un archivo de imagen válido.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setPendingPhoto(reader.result);
  };
  reader.readAsDataURL(file);
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Tu navegador no soporta acceso a cámara.');
    return;
  }

  const isSecureContext = window.isSecureContext || location.hostname === 'localhost';
  if (!isSecureContext) {
    alert('La cámara sólo funciona en sitios seguros o en localhost. Abre la página desde un servidor local y acepta los permisos.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false
    });

    elements.cameraPreview.srcObject = stream;
    elements.cameraOverlay.classList.add('hidden');
    elements.captureBtn.disabled = false;
    elements.switchCameraBtn.disabled = false;
    elements.startCameraBtn.textContent = 'Cámara activa';
  } catch (error) {
    console.error('Error al acceder a la cámara:', error);
    alert('No se pudo acceder a la cámara. Verifica los permisos del navegador o usa una imagen desde tu galería.');
  }
}

async function switchCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';

  if (stream) {
    stopCamera();
  }

  await startCamera();
}

function stopCamera() {
  if (!stream) return;

  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  elements.cameraPreview.srcObject = null;
  elements.captureBtn.disabled = true;
  elements.switchCameraBtn.disabled = true;
  elements.startCameraBtn.textContent = 'Activar cámara';
  elements.cameraOverlay.classList.remove('hidden');
}

function captureFromCamera() {
  if (!elements.cameraPreview.videoWidth || !elements.cameraPreview.videoHeight) {
    alert('Primero activa la cámara.');
    return;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = elements.cameraPreview.videoWidth;
  canvas.height = elements.cameraPreview.videoHeight;

  context.drawImage(elements.cameraPreview, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  setPendingPhoto(dataUrl);
}

function setPendingPhoto(dataUrl) {
  pendingPhoto = dataUrl;
  elements.photoPreview.src = dataUrl;
  elements.photoPreviewBox.classList.add('has-photo');
}

function savePhoto(event) {
  event.preventDefault();

  if (!pendingPhoto) {
    alert('Primero selecciona o captura una foto.');
    return;
  }

  const title = elements.titleInput.value.trim();
  const author = elements.authorInput.value.trim();
  const category = elements.categoryInput.value.trim();
  const description = elements.descriptionInput.value.trim();

  if (!title || !author || !category) {
    alert('Completa al menos el título, autor y categoría.');
    return;
  }

  const newItem = {
    id: generateId(),
    title,
    author,
    category,
    description,
    date: new Date().toISOString(),
    image: pendingPhoto
  };

  album.unshift(newItem);
  saveAlbum();
  populateCategoryOptions();
  renderCategoryChips();
  renderGallery();
  resetForm();
}

function resetForm() {
  elements.photoForm.reset();
  pendingPhoto = '';
  elements.photoPreview.src = '';
  elements.photoPreviewBox.classList.remove('has-photo');
  elements.fileInput.value = '';
}

function renderGallery() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const selectedCategory = elements.categoryFilter.value || 'Todas';

  const filtered = album.filter((item) => {
    const matchesCategory = selectedCategory === 'Todas' || item.category === selectedCategory;
    const searchableText = `${item.title} ${item.author}`.toLowerCase();
    const matchesSearch = !query || searchableText.includes(query);

    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    elements.galleryGrid.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.galleryGrid.innerHTML = filtered
    .map((item) => {
      const dateLabel = formatDate(item.date);
      return `
        <article class="photo-card" data-id="${item.id}" tabindex="0">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" />
          <div class="card-body">
            <div class="card-header">
              <h3 class="card-title">${escapeHtml(item.title)}</h3>
              <span class="card-tag">${escapeHtml(item.category)}</span>
            </div>
            <p class="card-author">${escapeHtml(item.author)}</p>
            <div class="card-date">${dateLabel}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

function openModal(photoId) {
  const item = album.find((entry) => entry.id === photoId);
  if (!item) return;

  selectedPhotoId = photoId;

  elements.modalTitle.textContent = item.title;
  elements.modalAuthor.textContent = `Por ${item.author}`;
  elements.modalCategory.textContent = item.category;
  elements.modalDate.textContent = formatDate(item.date);
  elements.modalDescription.textContent = item.description || 'Sin descripción adicional.';
  elements.modalImage.src = item.image;
  elements.modalImage.alt = item.title;
  elements.downloadLink.href = item.image;
  elements.downloadLink.download = `${slugify(item.title || 'foto')}.jpg`;

  elements.modal.classList.remove('hidden');
  elements.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  elements.modal.classList.add('hidden');
  elements.modal.setAttribute('aria-hidden', 'true');
  selectedPhotoId = null;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'foto';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
