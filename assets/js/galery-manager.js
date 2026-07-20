/**
 * Galery Manager
 * Gestion des réalisations stockées sur le serveur
 */

class GaleryManager {
  constructor() {
    this.API_URL = 'forms/gallery-api.php';
    this.photos = this.getDefaultPhotos();
    this.currentPhotoIndex = 0;
    this.isAuthenticated = false;
  }

  async init() {
    this.setupEventListeners();
    await this.loadPhotos();
    this.renderGalery();
    this.createLightbox();
  }

  // ===== API =====
  async apiRequest(action, options = {}) {
    const { method = 'GET', body = null } = options;
    const url = new URL(this.API_URL, window.location.href);

    if (method === 'GET') {
      url.searchParams.set('action', action);
    }

    const response = await fetch(url.toString(), {
      method,
      body,
      credentials: 'same-origin'
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('Réponse serveur invalide');
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Erreur serveur (${response.status})`);
    }

    return data;
  }

  async loadPhotos() {
    try {
      const data = await this.apiRequest('list');
      this.photos = Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      console.error('Chargement de la galerie impossible:', error);
      this.photos = this.getDefaultPhotos();
      this.showAlert(
        'Impossible de charger la galerie depuis le serveur. Le site affiche la version locale.',
        'warning'
      );
    }
  }

  getDefaultPhotos() {
    return [
      {
        id: 'default-1',
        image: 'assets/img/reparation-benne-camion-beauzac.png',
        type: 'image',
        isDefault: true
      },
      {
        id: 'default-2',
        image: 'assets/img/reparation-broyeur-carriere-beauzac.png',
        type: 'image',
        isDefault: true
      },
      {
        id: 'default-3',
        image: 'assets/img/creation-godets-camion-beauzac.png',
        type: 'image',
        isDefault: true
      }
    ];
  }

  // ===== LIGHTBOX =====
  createLightbox() {
    if (document.getElementById('photo-lightbox')) {
      return;
    }

    const lightboxHTML = `
      <div id="photo-lightbox" class="photo-lightbox" style="display: none;">
        <div class="lightbox-overlay" onclick="galeryManager.closeLightbox()"></div>
        <div class="lightbox-container">
          <button class="lightbox-close" onclick="galeryManager.closeLightbox()">✕</button>
          <button class="lightbox-nav lightbox-prev" onclick="galeryManager.prevPhoto()">‹</button>
          <div id="lightbox-content" style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img id="lightbox-img" src="" alt="Photo agrandie" class="lightbox-img" style="display: none;">
            <video id="lightbox-video" class="lightbox-video" style="display: none;" controls></video>
          </div>
          <button class="lightbox-nav lightbox-next" onclick="galeryManager.nextPhoto()">›</button>
          <div class="lightbox-counter"><span id="current-index">1</span> / <span id="total-photos">1</span></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', lightboxHTML);
  }

  openLightbox(index) {
    if (!this.photos.length || !this.photos[index]) {
      return;
    }

    this.currentPhotoIndex = index;
    const lightbox = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    const video = document.getElementById('lightbox-video');
    const photo = this.photos[index];

    img.style.display = 'none';
    video.style.display = 'none';
    img.removeAttribute('src');
    video.removeAttribute('src');

    if (photo.type === 'video') {
      video.src = photo.image;
      video.style.display = 'block';
    } else {
      img.src = photo.image;
      img.style.display = 'block';
    }

    document.getElementById('current-index').textContent = index + 1;
    document.getElementById('total-photos').textContent = this.photos.length;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    const lightbox = document.getElementById('photo-lightbox');
    const video = document.getElementById('lightbox-video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (lightbox) {
      lightbox.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
  }

  nextPhoto() {
    if (!this.photos.length) return;
    const nextIndex = (this.currentPhotoIndex + 1) % this.photos.length;
    this.openLightbox(nextIndex);
  }

  prevPhoto() {
    if (!this.photos.length) return;
    const prevIndex = (this.currentPhotoIndex - 1 + this.photos.length) % this.photos.length;
    this.openLightbox(prevIndex);
  }

  // ===== AUTHENTIFICATION =====
  setupEventListeners() {
    const adminLink = document.getElementById('admin-link');
    const passwordSubmit = document.getElementById('password-submit');
    const uploadForm = document.getElementById('upload-form');
    const adminPassword = document.getElementById('admin-password');

    if (adminLink) {
      adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openAdminModal();
      });
    }

    if (passwordSubmit) {
      passwordSubmit.addEventListener('click', () => this.login());
    }

    if (adminPassword) {
      adminPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.login();
        }
      });
    }

    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePhotoUpload();
      });
    }

    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('photo-lightbox');
      if (lightbox && lightbox.style.display !== 'none') {
        if (e.key === 'ArrowRight') this.nextPhoto();
        if (e.key === 'ArrowLeft') this.prevPhoto();
        if (e.key === 'Escape') this.closeLightbox();
      }
    });
  }

  async openAdminModal() {
    const modal = new bootstrap.Modal(document.getElementById('admin-modal'));
    modal.show();

    this.isAuthenticated = false;
    document.getElementById('password-error').style.display = 'none';
    document.getElementById('admin-password').classList.remove('is-invalid');
    document.getElementById('admin-password').value = '';

    try {
      const status = await this.apiRequest('status');
      if (status.authenticated) {
        this.isAuthenticated = true;
        this.showAdminPanel();
      } else {
        this.showPasswordForm();
      }
    } catch (error) {
      console.error('Impossible de vérifier la session admin:', error);
      this.showPasswordForm();
    }
  }

  showPasswordForm() {
    document.getElementById('password-form').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
  }

  showAdminPanel() {
    document.getElementById('password-form').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    this.renderPhotosList();
  }

  async login() {
    const password = document.getElementById('admin-password').value.trim();
    const errorMsg = document.getElementById('password-error');

    if (!password) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = 'Entrez le mot de passe';
      return;
    }

    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('password', password);

    try {
      await this.apiRequest('login', {
        method: 'POST',
        body: formData
      });

      this.isAuthenticated = true;
      errorMsg.style.display = 'none';
      document.getElementById('admin-password').classList.remove('is-invalid');
      this.showAdminPanel();
      this.showAlert('Connexion admin réussie.', 'success');
    } catch (error) {
      errorMsg.style.display = 'block';
      errorMsg.textContent = 'Mot de passe incorrect';
      document.getElementById('admin-password').classList.add('is-invalid');
    }
  }

  // ===== GESTION DES PHOTOS =====
  async handlePhotoUpload() {
    const fileInput = document.getElementById('photo-file');
    const files = Array.from(fileInput.files || []);

    if (files.length === 0) {
      alert('Veuillez sélectionner au moins une photo ou vidéo');
      return;
    }

    if (!this.isAuthenticated) {
      this.showAlert('Vous devez être connecté pour ajouter des médias.', 'warning');
      return;
    }

    this.showAlert('⏳ Téléversement vers le serveur en cours...', 'info');

    let uploadedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        await this.uploadOneFile(file);
        uploadedCount += 1;
      } catch (error) {
        console.error(`Upload impossible pour ${file.name}:`, error);
        failedCount += 1;
      }
    }

    await this.loadPhotos();
    this.renderGalery();
    this.renderPhotosList();
    document.getElementById('upload-form').reset();

    let message = '';
    if (uploadedCount > 0) {
      message = uploadedCount === 1
        ? '✅ 1 fichier ajouté sur le serveur'
        : `✅ ${uploadedCount} fichiers ajoutés sur le serveur`;
    }
    if (failedCount > 0) {
      message += (message ? '\n' : '') + `⚠️ ${failedCount} fichier(s) refusé(s)`;
    }

    this.showAlert(message || 'Aucun fichier ajouté.', uploadedCount > 0 ? 'success' : 'warning');
  }

  async uploadOneFile(file) {
    const mediaType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : null;

    if (!mediaType) {
      throw new Error('Type non supporté');
    }

    if (mediaType === 'image') {
      const blob = await this.compressImage(file);
      const filename = this.buildUploadName(file.name, 'jpg');
      return this.sendUpload(blob, filename);
    }

    const ext = this.getExtensionFromMime(file.type) || this.getExtensionFromName(file.name) || 'mp4';
    const filename = this.buildUploadName(file.name, ext);
    return this.sendUpload(file, filename);
  }

  compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 1920;
          const maxHeight = 1920;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Compression impossible'));
              return;
            }
            resolve(blob);
          }, 'image/jpeg', 0.85);
        };

        img.onerror = () => reject(new Error('Image illisible'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Lecture fichier impossible'));
      reader.readAsDataURL(file);
    });
  }

  buildUploadName(originalName, extension) {
    const base = originalName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'media';

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    return `${base}-${suffix}.${extension}`;
  }

  getExtensionFromMime(mime) {
    const map = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/quicktime': 'mov'
    };

    return map[mime] || '';
  }

  getExtensionFromName(name) {
    const parts = name.split('.');
    if (parts.length < 2) return '';
    return parts.pop().toLowerCase();
  }

  async sendUpload(fileLike, filename) {
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('media', fileLike, filename);
    formData.append('filename', filename);

    await this.apiRequest('upload', {
      method: 'POST',
      body: formData
    });
  }

  async deletePhoto(photoId) {
    const photo = this.photos.find((item) => item.id === photoId);
    if (!photo) {
      return;
    }

    if (!confirm('Supprimer cette photo ?')) {
      return;
    }

    if (photo.isDefault) {
      this.showAlert('Les images de base ne se suppriment pas depuis l\'admin.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('id', photoId);

    try {
      await this.apiRequest('delete', {
        method: 'POST',
        body: formData
      });

      await this.loadPhotos();
      this.renderGalery();
      this.renderPhotosList();
      this.showAlert('Photo supprimée !', 'info');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      this.showAlert('La suppression a échoué.', 'danger');
    }
  }

  // ===== AFFICHAGE =====
  renderGalery() {
    const grid = document.getElementById('galery-grid');
    if (!grid) return;

    if (this.photos.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = this.photos.map((media, index) => {
      const isVideo = media.type === 'video';
      const content = isVideo
        ? `
          <video class="galery-item-img" style="height: 100%; width: 100%; object-fit: cover; background: #000;" muted playsinline preload="metadata">
            <source src="${media.image}" type="video/mp4">
          </video>
          <div class="video-badge">📹 VIDÉO</div>
        `
        : `
          <img src="${media.image}" alt="Réalisation" class="galery-item-img" loading="lazy">
        `;

      return `
        <a href="javascript:void(0)" class="galery-item" onclick="galeryManager.openLightbox(${index}); return false;">
          ${content}
        </a>
      `;
    }).join('');
  }

  renderPhotosList() {
    const list = document.getElementById('photos-list');
    if (!list) return;

    if (this.photos.length === 0) {
      list.innerHTML = '<p class="text-muted">Aucune photo ou vidéo</p>';
      return;
    }

    list.innerHTML = this.photos.map((media, index) => {
      const isVideo = media.type === 'video';
      const mediaLabel = isVideo ? '📹 Vidéo' : '🖼️ Photo';
      const thumbnail = isVideo
        ? `<video class="photo-thumbnail" style="background: #000;" muted playsinline preload="metadata"><source src="${media.image}"></video>`
        : `<img src="${media.image}" alt="Aperçu" class="photo-thumbnail">`;

      return `
        <div class="list-group-item">
          <div class="photo-preview-container">
            ${thumbnail}
            <div class="photo-info">
              <h6>${mediaLabel} ${index + 1}</h6>
              <small class="d-block text-muted" style="font-size: 11px;">${media.filename || ''}</small>
            </div>
          </div>
          <button class="delete-btn" onclick="galeryManager.deletePhoto('${media.id}')">
            Supprimer
          </button>
        </div>
      `;
    }).join('');
  }

  // ===== UTILITAIRES =====
  showAlert(message, type) {
    if (!message) return;

    const container = document.getElementById('admin-panel');
    if (!container) return;

    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = alertHtml;
    container.insertBefore(wrapper.firstElementChild, container.firstChild);

    setTimeout(() => {
      const alert = container.querySelector('.alert');
      if (alert) alert.remove();
    }, 3000);
  }
}

let galeryManager;
document.addEventListener('DOMContentLoaded', () => {
  galeryManager = new GaleryManager();
  galeryManager.init().catch((error) => {
    console.error('Erreur d\'initialisation de la galerie:', error);
  });
});
