# Backend d'upload pour la galerie

Ce backend est prévu pour GitHub Pages.

Il fait 3 choses:
- vérifie le mot de passe admin
- reçoit les photos/vidéos depuis la page galerie
- écrit les fichiers dans le dépôt GitHub via l'API Contents

## Pourquoi ce backend

GitHub Pages est statique. Il ne peut pas enregistrer des uploads depuis le navigateur.
Le backend externe sert d'intermédiaire et pousse les fichiers dans le dépôt, puis GitHub Pages les publie.

## Variables à configurer

- `GITHUB_OWNER`: ton nom d'utilisateur ou organisation GitHub
- `GITHUB_REPO`: le nom du dépôt
- `GITHUB_BRANCH`: la branche publiée, souvent `main`
- `GALLERY_PASSWORD`: mot de passe admin
- `GITHUB_TOKEN`: token GitHub fine-grained avec permission `Contents: Read and write`
- `GALLERY_SECRET`: secret long aléatoire pour signer les tokens d'accès admin

## Fichiers modifiés côté site

- définir `window.GALLERY_API_URL` dans [assets/js/gallery-config.js](../../assets/js/gallery-config.js)
- le site appelle ensuite ce backend depuis [assets/js/galery-manager.js](../../assets/js/galery-manager.js)

## Déploiement Cloudflare Workers

1. Installer Wrangler
2. Se connecter à Cloudflare
3. Déployer le dossier `backend/cloudflare-worker`
4. Créer les secrets:
   - `wrangler secret put GITHUB_TOKEN`
   - `wrangler secret put GALLERY_SECRET`
5. Tester l'URL publique du worker

## API

- `GET ?action=status`
- `POST ?action=login`
- `GET ?action=list`
- `POST ?action=upload`
- `POST ?action=delete`

## Stockage dans GitHub

Les médias sont écrits dans:
- `assets/uploads/realisations/`

La liste des médias ajoutés est stockée dans:
- `assets/data/realisations.json`
