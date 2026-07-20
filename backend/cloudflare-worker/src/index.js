const DEFAULT_PHOTOS = [
  {
    id: 'default-1',
    image: 'assets/img/reparation-benne-camion-beauzac.png',
    type: 'image',
    isDefault: true,
    timestamp: 1
  },
  {
    id: 'default-2',
    image: 'assets/img/reparation-broyeur-carriere-beauzac.png',
    type: 'image',
    isDefault: true,
    timestamp: 2
  },
  {
    id: 'default-3',
    image: 'assets/img/creation-godets-camion-beauzac.png',
    type: 'image',
    isDefault: true,
    timestamp: 3
  }
];

const API_VERSION = '2022-11-28';
const GALLERY_DATA_PATH = 'assets/data/realisations.json';
const UPLOAD_DIR = 'assets/uploads/realisations';
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return uint8ToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function stringToBase64(str) {
  return uint8ToBase64(new TextEncoder().encode(str));
}

function base64ToString(input) {
  const normalized = input.replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function signToken(env, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(await hmacSha256(env.GALLERY_SECRET, body));
  return `${body}.${signature}`;
}

async function verifyToken(env, token) {
  if (!token || !env.GALLERY_SECRET) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [body, signature] = parts;
  const expected = base64UrlEncode(await hmacSha256(env.GALLERY_SECRET, body));
  if (expected !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function authHeader(request) {
  return request.headers.get('Authorization') || '';
}

function bearerToken(request) {
  const header = authHeader(request);
  if (!header.startsWith('Bearer ')) {
    return '';
  }
  return header.slice(7).trim();
}

function getGitHubConfig(env) {
  return {
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || 'main',
    token: env.GITHUB_TOKEN
  };
}

async function githubRequest(env, path, options = {}) {
  const cfg = getGitHubConfig(env);
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error('GitHub backend not configured');
  }

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${cfg.token}`);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('User-Agent', 'petiot-chaudronnerie-gallery-worker');
  headers.set('X-GitHub-Api-Version', API_VERSION);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

async function readJsonFile(env, path) {
  const response = await githubRequest(env, path, {
    method: 'GET'
  });

  if (response.status === 404) {
    return { sha: null, data: null };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  if (!payload.content) {
    return { sha: payload.sha || null, data: null };
  }

  const decoded = base64ToString(payload.content);
  return {
    sha: payload.sha || null,
    data: JSON.parse(decoded)
  };
}

async function writeJsonFile(env, path, data, sha, message) {
  const cfg = getGitHubConfig(env);
  const response = await githubRequest(env, path, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: stringToBase64(JSON.stringify(data, null, 2)),
      branch: cfg.branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed: ${response.status} ${text}`);
  }
}

async function deleteRepoFile(env, path, sha, message) {
  const cfg = getGitHubConfig(env);
  const response = await githubRequest(env, path, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha,
      branch: cfg.branch
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub delete failed: ${response.status} ${text}`);
  }
}

function defaultUploadName(originalName, extension) {
  const base = (originalName || 'media')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'media';

  return `${base}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}

function extensionFromMime(mime) {
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

function mediaTypeFromMime(mime) {
  if (mime && mime.startsWith('image/')) return 'image';
  if (mime && mime.startsWith('video/')) return 'video';
  return null;
}

function uploadedPublicPath(filename) {
  return `${UPLOAD_DIR}/${filename}`;
}

function galleryDefaults() {
  return DEFAULT_PHOTOS.slice();
}

async function listGallery(env) {
  const { data } = await readJsonFile(env, GALLERY_DATA_PATH);
  const uploaded = Array.isArray(data) ? data : [];
  const items = galleryDefaults().concat(uploaded);
  items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return items;
}

async function requireAuth(request, env) {
  const token = bearerToken(request);
  const payload = await verifyToken(env, token);
  if (!payload) {
    return null;
  }
  return payload;
}

async function handleLogin(request, env) {
  const formData = await request.formData();
  const password = String(formData.get('password') || '').trim();
  if (!env.GALLERY_PASSWORD) {
    return json({ success: false, message: 'Backend password missing' }, { status: 500 });
  }

  if (password !== env.GALLERY_PASSWORD) {
    return json({ success: false, message: 'Mot de passe incorrect' }, { status: 401 });
  }

  const token = await signToken(env, {
    sub: 'gallery-admin',
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  });

  return json({
    success: true,
    authenticated: true,
    token
  });
}

async function handleUpload(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth) {
    return json({ success: false, message: 'Authentification requise' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('media');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return json({ success: false, message: 'Aucun fichier reçu' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return json({ success: false, message: 'Fichier trop volumineux' }, { status: 400 });
  }

  const mime = file.type || '';
  const mediaType = mediaTypeFromMime(mime);
  if (!mediaType) {
    return json({ success: false, message: 'Type de fichier non supporté' }, { status: 400 });
  }

  const extension = extensionFromMime(mime) || 'bin';
  const originalFilename = String(formData.get('filename') || file.name || 'media');
  const safeFilename = defaultUploadName(originalFilename, extension);
  const filePath = `${UPLOAD_DIR}/${safeFilename}`;
  const gh = getGitHubConfig(env);

  const arrayBuffer = await file.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

  const uploadResponse = await githubRequest(env, filePath, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add gallery media ${safeFilename}`,
      content: base64,
      branch: gh.branch
    })
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    return json({ success: false, message: `GitHub upload failed: ${text}` }, { status: 500 });
  }

  const { sha, data } = await readJsonFile(env, GALLERY_DATA_PATH);
  const items = Array.isArray(data) ? data : [];
  const item = {
    id: `media-${crypto.randomUUID()}`,
    image: uploadedPublicPath(safeFilename),
    type: mediaType,
    isDefault: false,
    timestamp: Date.now(),
    filename: originalFilename
  };
  items.push(item);

  await writeJsonFile(env, GALLERY_DATA_PATH, items, sha, `Update gallery data with ${safeFilename}`);

  return json({
    success: true,
    item
  });
}

async function handleDelete(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth) {
    return json({ success: false, message: 'Authentification requise' }, { status: 403 });
  }

  const formData = await request.formData();
  const id = String(formData.get('id') || '').trim();
  if (!id) {
    return json({ success: false, message: 'ID manquant' }, { status: 400 });
  }

  const { sha, data } = await readJsonFile(env, GALLERY_DATA_PATH);
  const items = Array.isArray(data) ? data : [];
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return json({ success: false, message: 'Média introuvable' }, { status: 404 });
  }

  if (item.isDefault) {
    return json({ success: false, message: 'Impossible de supprimer une image de base' }, { status: 400 });
  }

  const filtered = items.filter((entry) => entry.id !== id);
  await writeJsonFile(env, GALLERY_DATA_PATH, filtered, sha, `Remove gallery item ${id}`);

  const imagePath = String(item.image || '');
  if (imagePath.startsWith(UPLOAD_DIR + '/')) {
    const repoPath = imagePath;
    const fileResponse = await githubRequest(env, repoPath, {
      method: 'GET'
    });

    if (fileResponse.ok) {
      const fileData = await fileResponse.json();
      if (fileData.sha) {
        await deleteRepoFile(env, repoPath, fileData.sha, `Delete gallery file ${id}`);
      }
    }
  }

  return json({
    success: true
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || (request.method === 'POST' ? await (async () => {
      try {
        const formData = await request.clone().formData();
        return String(formData.get('action') || 'list');
      } catch {
        return 'list';
      }
    })() : 'list');

    try {
      if (action === 'status') {
        const token = bearerToken(request);
        const payload = await verifyToken(env, token);
        return json({
          success: true,
          authenticated: !!payload
        });
      }

      if (action === 'login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }

      if (action === 'list' && request.method === 'GET') {
        const items = await listGallery(env);
        return json({
          success: true,
          items
        });
      }

      if (action === 'upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }

      if (action === 'delete' && request.method === 'POST') {
        return await handleDelete(request, env);
      }

      return json({ success: false, message: 'Action inconnue' }, { status: 400 });
    } catch (error) {
      return json({
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      }, { status: 500 });
    }
  }
};
