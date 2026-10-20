const STORAGE_KEY = 'pixelNestAlbum';
const SYNCED_STORAGE_KEY = 'pixelNestSyncedPhotos';
const OWNER_TOKEN_STORAGE_KEY = 'pixelNestOwnerToken';
const STORAGE_BUCKET = 'pixelnest-photos';
const CATEGORIES = ['Personas', 'Objetos', 'Actividades', 'Horarios'];
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
  closeModalBtn: document.getElementById('closeModalBtn'),
  cloudStatus: document.getElementById('cloudStatus'),
  adminStatus: document.getElementById('adminStatus'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminEmail: document.getElementById('adminEmail'),
  adminPassword: document.getElementById('adminPassword'),
  downloadLocalBackupBtn: document.getElementById('downloadLocalBackupBtn'),
  localBackupInput: document.getElementById('localBackupInput'),
  importLocalBackupBtn: document.getElementById('importLocalBackupBtn'),
  adminActions: document.getElementById('adminActions'),
  syncLocalPhotosBtn: document.getElementById('syncLocalPhotosBtn'),
  downloadBackupBtn: document.getElementById('downloadBackupBtn'),
  adminSignOutBtn: document.getElementById('adminSignOutBtn')
};

let album = loadAlbum();
let pendingPhoto = '';
let stream = null;
let facingMode = 'environment';
let selectedPhotoId = null;
let activePromptIndex = 0;
let promptDrafts = {};
let drawingHistory = [];
let cloudClient = null;
let cloudSession = null;
let cloudPhotos = [];
let syncedPhotoIds = loadSyncedPhotoIds();
let ownerToken = loadOwnerToken();

window.addEventListener('DOMContentLoaded', () => {
  clearLegacyCategories();
  bindEvents();
  elements.categoryInput.value = getPromptItem(activePromptIndex)?.category || '';
  renderPrompt();
  renderGallery();
  updateStorageStat();
  initializeCloud();
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
  elements.adminLoginForm.addEventListener('submit', signInAdmin);
  elements.downloadLocalBackupBtn.addEventListener('click', downloadLocalBackup);
  elements.importLocalBackupBtn.addEventListener('click', () => elements.localBackupInput.click());
  elements.localBackupInput.addEventListener('change', importLocalBackup);
  elements.syncLocalPhotosBtn.addEventListener('click', syncLocalPhotos);
  elements.downloadBackupBtn.addEventListener('click', downloadBackup);
  elements.adminSignOutBtn.addEventListener('click', signOutAdmin);

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

    deleteSelectedPhoto();
  });

  elements.downloadLink.addEventListener('click', (event) => {
    const item = findPhoto(selectedPhotoId);
    if (!item) {
      event.preventDefault();
      return;
    }

    const safeName = slugify(item.title || 'foto');
    elements.downloadLink.download = `${safeName}.jpg`;
  });
}

async function initializeCloud() {
  const config = window.PIXELNEST_SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey) {
    elements.cloudStatus.textContent = 'Las fotos se guardan en este navegador. Configura el archivo central para recibir fotos de otros dispositivos.';
    return;
  }

  if (location.protocol === 'file:') {
    elements.cloudStatus.textContent = 'Para sincronizar, publica esta página en un sitio HTTPS. En modo archivo local solo se guardan fotos en este navegador.';
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    elements.cloudStatus.textContent = 'No se pudo cargar el servicio de sincronización. Revisa tu conexión a internet.';
    console.error('No se pudo cargar el cliente de Supabase.');
    return;
  }

  try {
    cloudClient = window.supabase.createClient(config.url, config.anonKey);
    elements.cloudStatus.textContent = 'Las fotos nuevas se enviarán al archivo central. Solo la administradora puede consultar la galería completa.';

    const { data, error } = await cloudClient.auth.getSession();
    if (error) throw error;
    cloudSession = data.session;

    updateAdminControls();
    if (cloudSession) {
      try {
        await loadCloudPhotos();
      } catch (loadError) {
        console.error('No se pudieron cargar las fotos centrales:', loadError);
        elements.adminStatus.textContent = 'Sesión iniciada, pero no se pudieron cargar las fotos. Revisa las políticas de acceso.';
      }
    }
    await syncPendingLocalPhotos();
  } catch (error) {
    console.error('No se pudo iniciar la sincronización:', error);
    elements.adminStatus.textContent = 'No se pudo conectar con el archivo central. Revisa la configuración.';
  }
}

async function signInAdmin(event) {
  event.preventDefault();
  if (!cloudClient) {
    elements.adminStatus.textContent = 'Primero configura el archivo central.';
    return;
  }

  try {
    const { data, error } = await cloudClient.auth.signInWithPassword({
      email: elements.adminEmail.value.trim(),
      password: elements.adminPassword.value
    });
    if (error) throw error;

    cloudSession = data.session;
    elements.adminPassword.value = '';
    updateAdminControls();
    await loadCloudPhotos();
  } catch (error) {
    console.error('No se pudo iniciar sesión o cargar el archivo central:', error);
    if (cloudSession) {
      elements.adminStatus.textContent = 'Sesión iniciada, pero no se pudieron cargar las fotos. Revisa las políticas de acceso.';
      return;
    }

    const message = error instanceof Error ? error.message : 'Error de autenticación sin más detalles.';
    elements.adminStatus.textContent = `Supabase rechazó el inicio de sesión: ${message}`;
  }
}

async function signOutAdmin() {
  if (!cloudClient) return;

  try {
    const { error } = await cloudClient.auth.signOut();
    if (error) throw error;
    cloudSession = null;
    cloudPhotos = [];
    updateAdminControls();
    renderGallery();
  } catch (error) {
    console.error('No se pudo cerrar la sesión del archivo central:', error);
    elements.adminStatus.textContent = 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
  }
}

function updateAdminControls() {
  const isSignedIn = Boolean(cloudSession);
  elements.adminLoginForm.classList.toggle('hidden', isSignedIn);
  elements.adminActions.classList.toggle('hidden', !isSignedIn);

  if (isSignedIn) {
    elements.adminStatus.textContent = `Sesión: ${cloudSession.user.email}. Fotos centrales: ${cloudPhotos.length}.`;
  } else {
    elements.adminStatus.textContent = 'Inicia sesión para consultar y respaldar las fotos de todos los dispositivos.';
  }
  updateStorageStat();
}

async function loadCloudPhotos() {
  if (!cloudClient || !cloudSession) return;

  const { data, error } = await cloudClient
    .from('photos')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;

  const loadedPhotos = await Promise.all(data.map(async (photo) => {
    const { data: signedData, error: signedError } = await cloudClient
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(photo.image_path, 86400);

    if (signedError) throw signedError;
    return { ...photo, image: signedData.signedUrl, isCloud: true };
  }));

  cloudPhotos = loadedPhotos;
  updateAdminControls();
  renderGallery();
}

async function syncPhotoToCloud(item) {
  if (!cloudClient) throw new Error('El archivo central no está configurado.');

  syncedPhotoIds.delete(item.id);
  saveSyncedPhotoIds();
  const imageResponse = await fetch(item.image);
  if (!imageResponse.ok) throw new Error('No se pudo leer la imagen para sincronizarla.');
  const imageBlob = await imageResponse.blob();
  const imagePath = `${item.id}/${generateId()}.jpg`;
  const { error: uploadError } = await cloudClient
    .storage
    .from(STORAGE_BUCKET)
    .upload(imagePath, imageBlob, {
      contentType: imageBlob.type || 'image/jpeg',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const record = {
    id: item.id,
    prompt_id: Number.isInteger(item.promptId) ? item.promptId : 0,
    question: item.question || item.title || '',
    title: item.title || 'Foto',
    author: item.author || '',
    category: CATEGORIES.includes(item.category) ? item.category : null,
    description: item.description || '',
    date: item.date || new Date().toISOString(),
    image_path: imagePath
  };
  const { error: recordError } = await cloudClient
    .rpc('pixelnest_submit_photo', {
      p_id: record.id,
      p_prompt_id: record.prompt_id,
      p_question: record.question,
      p_title: record.title,
      p_author: record.author,
      p_category: record.category,
      p_description: record.description,
      p_date: record.date,
      p_image_path: record.image_path,
      p_owner_token: ownerToken
    });

  if (recordError) {
    throw recordError;
  }

  syncedPhotoIds.add(item.id);
  saveSyncedPhotoIds();
}

async function syncPendingLocalPhotos(forceIds = new Set()) {
  let synced = 0;
  const failures = [];

  for (const item of album) {
    if (!forceIds.has(item.id)) {
      if (cloudSession && cloudPhotos.some((photo) => photo.id === item.id)) continue;
      if (!cloudSession && syncedPhotoIds.has(item.id)) continue;
    } else if (cloudSession) {
      const existingCloudPhoto = cloudPhotos.find((photo) => photo.id === item.id);
      if (existingCloudPhoto
        && existingCloudPhoto.owner_token
        && existingCloudPhoto.owner_token !== ownerToken) continue;
    }

    try {
      await syncPhotoToCloud(item);
      synced += 1;
    } catch (error) {
      console.error(`No se pudo sincronizar la foto local ${item.id}:`, error);
      failures.push(item.id);
    }
  }

  if (cloudSession) {
    try {
      await loadCloudPhotos();
    } catch (error) {
      console.error('No se pudo actualizar la galería central:', error);
    }
  }

  if (failures.length) {
    elements.cloudStatus.textContent = `${failures.length} foto(s) de este dispositivo no se pudieron sincronizar. Siguen guardadas localmente; revisa la conexión.`;
  } else if (synced) {
    elements.cloudStatus.textContent = `${synced} foto(s) de este dispositivo se copiaron al archivo central.`;
  }
}

function loadSyncedPhotoIds() {
  try {
    const raw = localStorage.getItem(SYNCED_STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (error) {
    console.error('No se pudo cargar el estado de sincronización local:', error);
    return new Set();
  }
}

function loadOwnerToken() {
  try {
    const existingToken = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
    if (existingToken) return existingToken;

    const newToken = generateId();
    localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, newToken);
    return newToken;
  } catch (error) {
    console.error('No se pudo guardar el identificador privado de este dispositivo:', error);
    return generateId();
  }
}

function saveSyncedPhotoIds() {
  try {
    localStorage.setItem(SYNCED_STORAGE_KEY, JSON.stringify([...syncedPhotoIds]));
  } catch (error) {
    console.error('No se pudo guardar el estado de sincronización local:', error);
    elements.cloudStatus.textContent = 'La foto llegó al archivo central, pero el navegador no pudo registrar la sincronización.';
  }
}

async function syncLocalPhotos() {
  if (!cloudClient || !cloudSession) return;

  elements.syncLocalPhotosBtn.disabled = true;
  const unsynced = album.filter((item) => !cloudPhotos.some((photo) => photo.id === item.id));
  let synced = 0;
  const failures = [];

  try {
    for (const [index, item] of unsynced.entries()) {
      elements.adminStatus.textContent = `Sincronizando foto ${index + 1} de ${unsynced.length}...`;
      try {
        await syncPhotoToCloud(item);
        synced += 1;
      } catch (error) {
        console.error(`No se pudo sincronizar la foto ${item.id}:`, error);
        failures.push(item.id);
      }
    }

    await loadCloudPhotos();
    elements.adminStatus.textContent = failures.length
      ? `Se sincronizaron ${synced} fotos; ${failures.length} fallaron. Revisa tu conexión y vuelve a intentarlo.`
      : `Respaldo actualizado: ${synced} fotos sincronizadas.`;
  } catch (error) {
    console.error('No se pudo completar la sincronización del álbum:', error);
    elements.adminStatus.textContent = 'No se pudo actualizar el archivo central. Inténtalo de nuevo.';
  } finally {
    elements.syncLocalPhotosBtn.disabled = false;
  }
}

async function downloadBackup() {
  if (!cloudClient || !cloudSession) return;

  elements.downloadBackupBtn.disabled = true;
  const backup = [];

  try {
    for (const [index, item] of cloudPhotos.entries()) {
      elements.adminStatus.textContent = `Preparando respaldo ${index + 1} de ${cloudPhotos.length}...`;
      const { data, error } = await cloudClient
        .storage
        .from(STORAGE_BUCKET)
        .download(item.image_path);
      if (error) throw error;

      backup.push({
        id: item.id,
        promptId: item.prompt_id,
        question: item.question,
        title: item.title,
        author: item.author,
        category: item.category,
        description: item.description,
        date: item.date,
        image: await blobToDataUrl(data)
      });
    }

    downloadJsonFile(backup, `pixelnest-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
    elements.adminStatus.textContent = `Respaldo descargado: ${backup.length} fotos.`;
  } catch (error) {
    console.error('No se pudo descargar el respaldo:', error);
    elements.adminStatus.textContent = 'No se pudo descargar el respaldo. Revisa tu conexión y el espacio disponible.';
  } finally {
    elements.downloadBackupBtn.disabled = false;
  }
}

function downloadLocalBackup() {
  downloadJsonFile(album, `pixelnest-local-${new Date().toISOString().slice(0, 10)}.json`);
}

async function importLocalBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error('El archivo no contiene una lista de fotos.');

    const validPhotos = imported.map((item) => {
      if (!item || typeof item.image !== 'string' || !item.image.startsWith('data:image/')) {
        throw new Error('El respaldo contiene una foto inválida o sin imagen.');
      }

      const promptId = Number.isInteger(item.promptId) ? item.promptId : 0;
      const prompt = PROMPTS[promptId];
      const id = typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(item.id)
        ? item.id
        : generateId();
      return {
        id,
        promptId,
        question: item.question || (prompt && prompt.question) || item.title || 'Foto importada',
        title: item.title || (prompt && prompt.title) || 'Foto importada',
        author: item.author || 'Sin nombre',
        category: CATEGORIES.includes(item.category) ? item.category : '',
        description: item.description || '',
        date: item.date && !Number.isNaN(Date.parse(item.date)) ? item.date : new Date().toISOString(),
        image: item.image
      };
    });

    if (!window.confirm(`Se importarán ${validPhotos.length} fotos. Si ya existe una foto con el mismo identificador, se actualizará. ¿Continuar?`)) {
      return;
    }

    const mergedPhotos = new Map(album.map((item) => [item.id, item]));
    validPhotos.forEach((item) => mergedPhotos.set(item.id, item));
    album = [...mergedPhotos.values()];
    saveAlbum();
    renderPrompt();
    renderGallery();

    if (cloudClient) {
      await syncPendingLocalPhotos(new Set(validPhotos.map((item) => item.id)));
    }
    elements.adminStatus.textContent = `${validPhotos.length} fotos importadas en este dispositivo.`;
  } catch (error) {
    console.error('No se pudo importar el respaldo:', error);
    alert(`No se pudo importar el respaldo: ${error.message}`);
  } finally {
    elements.localBackupInput.value = '';
  }
}

function downloadJsonFile(data, filename) {
  const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo procesar una imagen del respaldo.'));
    reader.readAsDataURL(blob);
  });
}

async function deleteSelectedPhoto() {
  const item = findPhoto(selectedPhotoId);
  if (!item) return;

  const isCentralPhoto = cloudPhotos.some((photo) => photo.id === selectedPhotoId);
  const message = isCentralPhoto
    ? '¿Eliminar esta foto del archivo central y de este dispositivo? Esta acción no se puede deshacer.'
    : '¿Eliminar esta foto de este dispositivo?';
  if (!window.confirm(message)) return;

  if (isCentralPhoto) {
    try {
      const { error } = await cloudClient
        .from('photos')
        .delete()
        .eq('id', selectedPhotoId);
      if (error) throw error;

      const { error: storageError } = await cloudClient
        .storage
        .from(STORAGE_BUCKET)
        .remove([item.image_path]);
      if (storageError) {
        console.error('La foto se quitó del álbum, pero no se pudo borrar el archivo:', storageError);
        elements.adminStatus.textContent = 'La foto se quitó del álbum, pero quedó un archivo pendiente de limpieza.';
      }
      cloudPhotos = cloudPhotos.filter((photo) => photo.id !== selectedPhotoId);
    } catch (error) {
      console.error('No se pudo eliminar la foto central:', error);
      elements.adminStatus.textContent = 'No se pudo eliminar la foto del archivo central.';
      return;
    }
  }

  album = album.filter((photo) => photo.id !== selectedPhotoId);
  saveAlbum();
  updateAdminControls();
  renderPrompt();
  renderGallery();
  closeModal();
}

function findPhoto(photoId) {
  return cloudPhotos.find((photo) => photo.id === photoId)
    || album.find((photo) => photo.id === photoId);
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
  const total = cloudSession
    ? new Set([...album, ...cloudPhotos].map((item) => item.id)).size
    : album.length;
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

async function savePhoto(event) {
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

  if (cloudClient) {
    elements.savePhotoBtn.disabled = true;
    try {
      await syncPhotoToCloud(newItem);
      elements.cloudStatus.textContent = 'La foto se guardó en este dispositivo y se respaldó en el archivo central.';
      if (cloudSession) await loadCloudPhotos();
    } catch (error) {
      console.error('La foto se guardó localmente, pero no se pudo sincronizar:', error);
      const reason = error instanceof Error ? error.message : 'Error de sincronización sin más detalles.';
      elements.cloudStatus.textContent = `La foto quedó guardada solo en este dispositivo. No se pudo sincronizar: ${reason}`;
      alert(`La foto se guardó en este dispositivo, pero no se pudo enviar al archivo central: ${reason}`);
    } finally {
      elements.savePhotoBtn.disabled = false;
    }
  }

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
  const galleryItems = new Map();
  album.forEach((item) => galleryItems.set(item.id, item));
  cloudPhotos.forEach((item) => galleryItems.set(item.id, item));

  const filtered = [...galleryItems.values()].filter((item) => {
    const matchesCategory = selectedCategory === 'Todas' || item.category === selectedCategory;
    const searchableText = `${item.title} ${item.author} ${item.description}`.toLowerCase();
    const matchesSearch = !query || searchableText.includes(query);

    return matchesCategory && matchesSearch;
  }).sort((first, second) => new Date(second.date) - new Date(first.date));

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
        <article class="photo-card" data-id="${escapeHtml(item.id)}" tabindex="0">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" />
          <div class="card-body">
            <div class="card-header">
              <h3 class="card-title">${escapeHtml(item.title)}</h3>
              <span class="card-tag">${escapeHtml(item.category || 'Sin categoría')}</span>
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
  const item = findPhoto(photoId);
  if (!item) return;

  selectedPhotoId = photoId;

  elements.modalTitle.textContent = item.title;
  elements.modalAuthor.textContent = `Por ${item.author}`;
  elements.modalCategory.textContent = item.category || 'Sin categoría';
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
