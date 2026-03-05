/**
 * Galery Manager
 * Gestion simple des photos
 */

class GaleryManager {
  constructor() {
    this.PASSWORD = 'FABIAN';
    this.STORAGE_KEY = 'petiot_galery_photos';
    this.photos = this.loadPhotos();
    this.currentPhotoIndex = 0;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.renderGalery();
    this.createLightbox();
  }

  // ===== LIGHTBOX =====
  createLightbox() {
    // Créer la lightbox HTML
    if (!document.getElementById('photo-lightbox')) {
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
  }

  openLightbox(index) {
    this.currentPhotoIndex = index;
    const lightbox = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    const video = document.getElementById('lightbox-video');
    const photo = this.photos[index];
    
    // Masquer les deux par défaut
    img.style.display = 'none';
    video.style.display = 'none';
    
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
    lightbox.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  nextPhoto() {
    const nextIndex = (this.currentPhotoIndex + 1) % this.photos.length;
    this.openLightbox(nextIndex);
  }

  prevPhoto() {
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
      passwordSubmit.addEventListener('click', () => this.checkPassword());
    }

    if (adminPassword) {
      adminPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.checkPassword();
      });
    }

    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePhotoUpload();
      });
    }

    // Clavier pour la lightbox
    document.addEventListener('keydown', (e) => {
      const lightbox = document.getElementById('photo-lightbox');
      if (lightbox && lightbox.style.display !== 'none') {
        if (e.key === 'ArrowRight') this.nextPhoto();
        if (e.key === 'ArrowLeft') this.prevPhoto();
        if (e.key === 'Escape') this.closeLightbox();
      }
    });
  }

  openAdminModal() {
    const modal = new bootstrap.Modal(document.getElementById('admin-modal'));
    this.isAuthenticated = false;
    document.getElementById('password-form').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-password').value = '';
    document.getElementById('password-error').style.display = 'none';
    modal.show();
  }

  checkPassword() {
    const password = document.getElementById('admin-password').value;
    const errorMsg = document.getElementById('password-error');

    if (password === this.PASSWORD) {
      this.isAuthenticated = true;
      document.getElementById('password-form').style.display = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      errorMsg.style.display = 'none';
      this.renderPhotosList();
    } else {
      errorMsg.style.display = 'block';
      document.getElementById('admin-password').classList.add('is-invalid');
    }
  }

  // ===== GESTION DES PHOTOS =====
  loadPhotos() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Erreur lors du chargement des photos:', e);
        return this.getDefaultPhotos();
      }
    }
    return this.getDefaultPhotos();
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

  savePhotos() {
    try {
      const data = JSON.stringify(this.photos);
      const sizeInMB = new Blob([data]).size / (1024 * 1024);
      
      // Limite à 9.5MB (localStorage fait environ 10MB)
      if (sizeInMB > 9.5) {
        throw new Error('QUOTA_WARNING');
      }
      
      localStorage.setItem(this.STORAGE_KEY, data);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message === 'QUOTA_WARNING') {
        alert('⚠️ Espace de stockage saturé !\n\nLe navigateur ne peut plus stocker de photos/vidéos.\n\nSolution :\n• Supprimez d\'anciennes photos/vidéos pour libérer de l\'espace\n• Les vidéos prennent beaucoup plus d\'espace que les photos\n\nEspace utilisé : ' + (new Blob([JSON.stringify(this.photos)]).size / (1024 * 1024)).toFixed(2) + ' MB / ~10 MB max');
        // Recharger les anciennes photos depuis le storage
        this.photos = this.loadPhotos();
        throw e;
      }
      throw e;
    }
  }

  handlePhotoUpload() {
    const fileInput = document.getElementById('photo-file');
    const files = fileInput.files;

    if (files.length === 0) {
      alert('Veuillez sélectionner au moins une photo ou vidéo');
      return;
    }

    let uploadedCount = 0;
    let failedCount = 0;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB par fichier initial (sera compressé)

    // Afficher un message de chargement
    this.showAlert('⏳ Traitement et compression en cours...', 'info');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Vérifier la taille du fichier
      if (file.size > MAX_FILE_SIZE) {
        alert(`⚠️ Fichier trop volumineux: ${file.name}\n\nTaille maximale: 50MB\nTaille du fichier: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        failedCount++;
        continue;
      }
      
      // Détecter le type de fichier (image ou vidéo)
      const mediaType = file.type.startsWith('image') ? 'image' : 
                        file.type.startsWith('video') ? 'video' : null;

      if (!mediaType) {
        console.warn(`Fichier ignoré: ${file.name} (type non supporté)`);
        failedCount++;
        continue;
      }

      if (mediaType === 'image') {
        // Compression automatique des images
        this.compressAndUploadImage(file, i, files.length, () => {
          uploadedCount++;
          this.finalizeUpload(uploadedCount, failedCount, files.length);
        }, () => {
          failedCount++;
          this.finalizeUpload(uploadedCount, failedCount, files.length);
        });
      } else {
        // Pour les vidéos, pas de compression (trop lourd pour le navigateur)
        const reader = new FileReader();
        reader.onload = (e) => {
          const media = {
            id: 'media-' + Date.now() + '-' + i,
            image: e.target.result,
            type: mediaType,
            isDefault: false,
            timestamp: Date.now(),
            filename: file.name
          };

          this.photos.push(media);
          uploadedCount++;
          this.finalizeUpload(uploadedCount, failedCount, files.length);
        };

        reader.onerror = () => {
          console.error(`Erreur lors de la lecture du fichier: ${file.name}`);
          failedCount++;
          this.finalizeUpload(uploadedCount, failedCount, files.length);
        };

        reader.readAsDataURL(file);
      }
    }
  }

  compressAndUploadImage(file, index, totalFiles, onSuccess, onError) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculer les nouvelles dimensions (max 1920px de largeur)
        let width = img.width;
        let height = img.height;
        const maxWidth = 1920;
        const maxHeight = 1920;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Créer un canvas pour la compression
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compression progressive jusqu'à ce que l'image soit assez petite
        let quality = 0.85;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Si l'image est encore trop grosse, réduire la qualité
        while (compressedDataUrl.length > 1.5 * 1024 * 1024 && quality > 0.3) {
          quality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        const media = {
          id: 'media-' + Date.now() + '-' + index,
          image: compressedDataUrl,
          type: 'image',
          isDefault: false,
          timestamp: Date.now(),
          filename: file.name
        };

        this.photos.push(media);
        onSuccess();
      };
      
      img.onerror = () => {
        console.error(`Erreur lors du chargement de l'image: ${file.name}`);
        onError();
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = () => {
      console.error(`Erreur lors de la lecture du fichier: ${file.name}`);
      onError();
    };
    
    reader.readAsDataURL(file);
  }

  finalizeUpload(uploadedCount, failedCount, totalFiles) {
    if (uploadedCount + failedCount === totalFiles) {
      try {
        this.savePhotos();
        this.renderGalery();
        this.renderPhotosList();
        document.getElementById('upload-form').reset();
        
        let message = '';
        if (uploadedCount > 0) {
          message = uploadedCount === 1 
            ? '✅ Fichier ajouté et optimisé !' 
            : `✅ ${uploadedCount} fichiers ajoutés et optimisés !`;
        }
        if (failedCount > 0) {
          message += (message ? '\n' : '') + `⚠️ ${failedCount} fichier(s) ignoré(s)`;
        }
        
        this.showAlert(message, uploadedCount > 0 ? 'success' : 'warning');
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          // L'erreur a déjà été gérée dans savePhotos()
          document.getElementById('upload-form').reset();
        } else {
          throw e;
        }
      }
    }
  }

  deletePhoto(photoId) {
    if (confirm('Supprimer cette photo ?')) {
      this.photos = this.photos.filter(p => p.id !== photoId);
      this.savePhotos();
      this.renderGalery();
      this.renderPhotosList();
      this.showAlert('Photo supprimée !', 'info');
    }
  }

  // ===== AFFICHAGE DE LA GALERIE =====
  renderGalery() {
    const grid = document.getElementById('galery-grid');

    if (this.photos.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = this.photos.map((media, index) => {
      const isVideo = media.type === 'video';
      let thumbnail = media.image;
      
      // Pour les vidéos, on peut extraire un preview si disponible
      // Sinon on affiche une image de placeholder
      let content;
      
      if (isVideo) {
        content = `
          <video class="galery-item-img" style="height: 100%; width: 100%; object-fit: cover; background: #000;">
            <source src="${media.image}" type="video/mp4">
          </video>
          <div class="video-badge">📹 VIDÉO</div>
        `;
      } else {
        content = `
          <img src="${media.image}" alt="Réalisation" class="galery-item-img" loading="lazy">
        `;
      }

      return `
        <a href="javascript:void(0)" class="galery-item" onclick="galeryManager.openLightbox(${index}); return false;">
          ${content}
        </a>
      `;
    }).join('');
  }

  renderPhotosList() {
    const list = document.getElementById('photos-list');
    
    if (this.photos.length === 0) {
      list.innerHTML = '<p class="text-muted">Aucune photo ou vidéo</p>';
      return;
    }

    list.innerHTML = this.photos.map((media, index) => {
      const isVideo = media.type === 'video';
      const mediaLabel = isVideo ? '📹 Vidéo' : '🖼️ Photo';
      
      let thumbnail;
      if (isVideo) {
        thumbnail = `<video class="photo-thumbnail" style="background: #000;"><source src="${media.image}"></video>`;
      } else {
        thumbnail = `<img src="${media.image}" alt="Aperçu" class="photo-thumbnail">`;
      }

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
    const message_html = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    const alertContainer = document.getElementById('admin-panel');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message_html;
    alertContainer.insertBefore(tempDiv.firstElementChild, alertContainer.firstChild);
    
    setTimeout(() => {
      const alert = alertContainer.querySelector('.alert');
      if (alert) alert.remove();
    }, 3000);
  }
}

// Initialiser le gestionnaire de galerie quand la page est chargée
let galeryManager;
document.addEventListener('DOMContentLoaded', () => {
  galeryManager = new GaleryManager();
});
