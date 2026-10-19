const STORAGE_KEY = 'pixelNestAlbum';
const CATEGORIES = ['Personas', 'Objetos', 'Actividades'];
const PROMPTS = [
  {
    title: 'El cielo y tus horarios',
    question: 'Tómale una foto al cielo (dirección CityU) y cuéntanos: ¿En qué horario sueles frecuentar esta zona y por qué?',
    camera: 'environment'
  },
  {
    title: 'Cómo vivo este lugar',
    question: 'Activa la cámara trasera y muéstranos qué haces.',
    camera: 'environment'
  },
  {
    title: 'Cómo compartimos el espacio',
    question: '¡Tómate una selfie con tu grupo! Muéstranos con quiénes compartes este espacio.',
    camera: 'user'
  },
  {
    title: 'Lo que utilizas',
    question: 'Fotografía un elemento o servicio de esta zona que utilices frecuentemente. ¿Cómo cambiaría tu experiencia en este lugar si no estuviera disponible?',
    camera: 'environment'
  },
  {
    title: 'Imagina una transformación',
    question: 'Fotografía un espacio u objeto que te gustaría transformar. ¿Cómo te gustaría que fuera? ¡Dibújalo!',
    camera: 'environment',
    draw: true
  }
];

const elements = {
  storageStat: document.getElementById('storageStat'),
  cameraPreview: document.getElementById('cameraPreview'),
  cameraOverlay: document.getElementById('cameraOverlay'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  captureBtn: document.getElementById('captureBtn'),
  switchCameraBtn: document.getElementById('switchCameraBtn'),
  promptStepCount: document.getElementById('promptStepCount'),
  promptCompletion: document.getElementById('promptCompletion'),
  activePromptTitle: document.getElementById('activePromptTitle'),
  activePromptText: document.getElementById('activePromptText'),
  promptSteps: document.getElementById('promptSteps'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  photoForm: document.getElementById('photoForm'),
  photoPreviewBox: document.getElementById('photoPreviewBox'),
  photoPreview: document.getElementById('photoPreview'),
  authorInput: document.getElementById('authorInput'),
  categoryInput: document.getElementById('categoryInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  drawingTools: document.getElementById('drawingTools'),
  drawCanvas: document.getElementById('drawCanvas'),
  undoDrawingBtn: document.getElementById('undoDrawingBtn'),
  savePhotoBtn: document.getElementById('savePhotoBtn'),
  clearFormBtn: document.getElementById('clearFormBtn'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  galleryGrid: document.getElementById('galleryGrid'),
  emptyState: document.getElementById('emptyState'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalAuthor: document.getElementById('modalAuthor'),
  modalCategory: document.getElementById('modalCategory'),
  modalDate: document.getElementById('modalDate'),
  modalDescription: document.getElementById('modalDescription'),
  modalQuestion: document.getElementById('modalQuestion'),
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
let activePromptIndex = 0;
let promptDrafts = {};
let drawingHistory = [];

window.addEventListener('DOMContentLoaded', () => {
  clearLegacyCategories();
  bindEvents();
  elements.categoryInput.value = getPromptItem(activePromptIndex)?.category || '';
  renderPrompt();
  renderGallery();
  updateStorageStat();
});

function bindEvents() {
  elements.startCameraBtn.addEventListener('click', startCamera);
  elements.switchCameraBtn.addEventListener('click', switchCamera);
  elements.captureBtn.addEventListener('click', captureFromCamera);
  elements.promptSteps.addEventListener('click', (event) => {
    const step = event.target.closest('[data-prompt-index]');
    if (step) activatePrompt(Number(step.dataset.promptIndex));
  });
  elements.drawCanvas.addEventListener('pointerdown', startDrawing);
  elements.drawCanvas.addEventListener('pointermove', continueDrawing);
  elements.drawCanvas.addEventListener('pointerup', stopDrawing);
  elements.drawCanvas.addEventListener('pointercancel', stopDrawing);
  elements.undoDrawingBtn.addEventListener('click', undoDrawing);

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
  elements.categoryFilter.addEventListener('change', renderGallery);

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

function renderPrompt() {
  const prompt = PROMPTS[activePromptIndex];
  const completedCount = album.filter((item) => PROMPTS.some((entry) => entry.id === item.promptId)).length;

  elements.promptStepCount.textContent = `Pregunta ${activePromptIndex + 1} de ${PROMPTS.length}`;
  elements.promptCompletion.textContent = `${completedCount} de ${PROMPTS.length} respondidas`;
  elements.activePromptTitle.textContent = prompt.title;
  elements.activePromptText.textContent = prompt.question;
  elements.savePhotoBtn.textContent = getPromptItem(activePromptIndex) ? 'Actualizar foto' : 'Guardar foto';
  elements.drawingTools.classList.toggle('hidden', !prompt.draw || !pendingPhoto);
  elements.drawCanvas.classList.toggle('hidden', !prompt.draw || !pendingPhoto);
  elements.startCameraBtn.textContent = stream
    ? 'Cámara activa'
    : `Activar cámara ${prompt.camera === 'user' ? 'frontal' : 'trasera'}`;

  elements.promptSteps.innerHTML = PROMPTS.map((entry, index) => {
    const completed = Boolean(getPromptItem(index));
    return `<button type="button" class="prompt-step ${index === activePromptIndex ? 'active' : ''} ${completed ? 'completed' : ''}" data-prompt-index="${index}" aria-current="${index === activePromptIndex ? 'step' : 'false'}" aria-label="Pregunta ${index + 1}${completed ? ', respondida' : ''}">${index + 1}</button>`;
  }).join('');
}

function getPromptItem(index) {
  return album.find((item) => item.promptId === index);
}

function activatePrompt(index) {
  if (index < 0 || index >= PROMPTS.length || index === activePromptIndex) return;

  saveCurrentDraft();
  activePromptIndex = index;
  facingMode = PROMPTS[index].camera;

  const savedItem = getPromptItem(index);
  const draft = promptDrafts[index] || savedItem || {};
  pendingPhoto = draft.image || '';
  elements.descriptionInput.value = draft.description || '';
  elements.categoryInput.value = draft.category || '';
  elements.photoPreview.src = pendingPhoto;
  elements.photoPreviewBox.classList.toggle('has-photo', Boolean(pendingPhoto));
  elements.drawCanvas.classList.toggle('hidden', !PROMPTS[index].draw || !pendingPhoto);
  elements.drawingTools.classList.toggle('hidden', !PROMPTS[index].draw || !pendingPhoto);
  elements.undoDrawingBtn.disabled = true;
  drawingHistory = [];

  if (PROMPTS[index].draw && pendingPhoto) loadDrawingCanvas(pendingPhoto);
  renderPrompt();

  if (stream) {
    stopCamera();
    startCamera();
  }
}

function saveCurrentDraft() {
  if (pendingPhoto || elements.descriptionInput.value.trim() || elements.categoryInput.value) {
    promptDrafts[activePromptIndex] = {
      image: pendingPhoto,
      description: elements.descriptionInput.value.trim(),
      category: elements.categoryInput.value
    };
  }
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

function clearLegacyCategories() {
  let changed = false;

  album = album.map((item) => {
    if (!item.category || CATEGORIES.includes(item.category)) return item;

    changed = true;
    return { ...item, category: '' };
  });

  if (changed) saveAlbum();
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
  const isDrawingPrompt = PROMPTS[activePromptIndex].draw;
  elements.drawCanvas.classList.toggle('hidden', !isDrawingPrompt);
  elements.drawingTools.classList.toggle('hidden', !isDrawingPrompt);
  if (isDrawingPrompt) loadDrawingCanvas(dataUrl);
  renderPrompt();
}

function loadDrawingCanvas(dataUrl) {
  const image = new Image();
  image.onload = () => {
    const canvas = elements.drawCanvas;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    drawingHistory = [];
    elements.undoDrawingBtn.disabled = true;
  };
  image.src = dataUrl;
}

function startDrawing(event) {
  if (!PROMPTS[activePromptIndex].draw || !pendingPhoto) return;

  const canvas = elements.drawCanvas;
  canvas.setPointerCapture(event.pointerId);
  drawingHistory.push(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
  const context = canvas.getContext('2d');
  context.beginPath();
  const point = getCanvasPoint(event);
  context.moveTo(point.x, point.y);
  context.lineWidth = Math.max(5, canvas.width / 140);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#ef476f';
  elements.undoDrawingBtn.disabled = false;
}

function continueDrawing(event) {
  if (!elements.drawCanvas.hasPointerCapture(event.pointerId)) return;

  const point = getCanvasPoint(event);
  const context = elements.drawCanvas.getContext('2d');
  context.lineTo(point.x, point.y);
  context.stroke();
}

function stopDrawing(event) {
  if (!elements.drawCanvas.hasPointerCapture(event.pointerId)) return;

  elements.drawCanvas.releasePointerCapture(event.pointerId);
  pendingPhoto = elements.drawCanvas.toDataURL('image/jpeg', 0.92);
  elements.photoPreview.src = pendingPhoto;
}

function getCanvasPoint(event) {
  const rect = elements.drawCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * elements.drawCanvas.width / rect.width,
    y: (event.clientY - rect.top) * elements.drawCanvas.height / rect.height
  };
}

function undoDrawing() {
  const previous = drawingHistory.pop();
  if (!previous) return;

  elements.drawCanvas.getContext('2d').putImageData(previous, 0, 0);
  pendingPhoto = elements.drawCanvas.toDataURL('image/jpeg', 0.92);
  elements.photoPreview.src = pendingPhoto;
  elements.undoDrawingBtn.disabled = drawingHistory.length === 0;
}

function savePhoto(event) {
  event.preventDefault();

  if (!pendingPhoto) {
    alert('Primero selecciona o captura una foto.');
    return;
  }

  const author = elements.authorInput.value.trim();
  const category = elements.categoryInput.value;
  const description = elements.descriptionInput.value.trim();

  if (!author || !category || !description) {
    alert('Escribe tu nombre, elige una categoría y responde la pregunta antes de guardar.');
    return;
  }

  const prompt = PROMPTS[activePromptIndex];
  const existingItem = getPromptItem(activePromptIndex);
  const newItem = {
    id: existingItem ? existingItem.id : generateId(),
    promptId: activePromptIndex,
    question: prompt.question,
    title: prompt.title,
    author,
    category,
    description,
    date: new Date().toISOString(),
    image: pendingPhoto
  };

  album = album.filter((item) => item.promptId !== activePromptIndex);
  album.unshift(newItem);
  delete promptDrafts[activePromptIndex];
  saveAlbum();
  renderPrompt();
  renderGallery();

  const nextIndex = PROMPTS.findIndex((item, index) => index !== activePromptIndex && !getPromptItem(index));
  clearCurrentForm();
  if (nextIndex !== -1) activatePrompt(nextIndex);
}

function resetForm() {
  delete promptDrafts[activePromptIndex];
  clearCurrentForm();
  renderPrompt();
}

function clearCurrentForm() {
  const author = elements.authorInput.value;
  elements.photoForm.reset();
  elements.authorInput.value = author;
  pendingPhoto = '';
  elements.photoPreview.src = '';
  elements.photoPreviewBox.classList.remove('has-photo');
  elements.fileInput.value = '';
  elements.drawCanvas.getContext('2d').clearRect(0, 0, elements.drawCanvas.width, elements.drawCanvas.height);
  elements.drawCanvas.classList.add('hidden');
  elements.drawingTools.classList.add('hidden');
  elements.undoDrawingBtn.disabled = true;
  drawingHistory = [];
}

function renderGallery() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const selectedCategory = elements.categoryFilter.value || 'Todas';

  const filtered = album.filter((item) => {
    const matchesCategory = selectedCategory === 'Todas' || item.category === selectedCategory;
    const searchableText = `${item.title} ${item.author} ${item.description}`.toLowerCase();
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
            <p class="card-author">Por ${escapeHtml(item.author)}</p>
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
  elements.modalQuestion.textContent = item.question || '';
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
