// ============================================
// CONFIGURATION
// ============================================
const CLOUDINARY_CLOUD_NAME = 'dlfyn1oeq';
const CLOUDINARY_UPLOAD_PRESET = 'THESIS-26';
const STORAGE_KEY = 'nostalgia-exhibit-images';
const SLIDESHOW_INTERVAL = 6000; // 6 seconds per image

// ============================================
// DOM Elements
// ============================================
const uploadArea = document.getElementById('uploadArea');
const uploadButton = document.getElementById('uploadButton');
const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');
const emptyMessage = document.getElementById('emptyMessage');
const slideshow = document.getElementById('slideshow');
const slideshowImage = document.getElementById('slideshowImage');
const slideshowCounter = document.getElementById('slideshowCounter');
const newUploadIndicator = document.getElementById('newUploadIndicator');
const navLinks = document.querySelectorAll('.nav-link');
const uploadSection = document.getElementById('uploadSection');
const archiveSection = document.getElementById('archiveSection');

// ============================================
// State
// ============================================
let slideshowTimer = null;
let currentSlideIndex = 0;
let isProjectionMode = false;
let isAdmin = false;
const ADMIN_PASSWORD = 'thesis26';

// ============================================
// Local Storage for Image Data
// ============================================
// Each entry: { url, width, height } or legacy string "url"
function getStoredImages() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function getImageUrl(entry) {
    return typeof entry === 'string' ? entry : entry.url;
}

function isPortraitEntry(entry) {
    if (typeof entry === 'object' && entry.width && entry.height) {
        return entry.height > entry.width;
    }
    return null; // unknown — needs detection
}

function saveImage(imageUrl, width, height) {
    const images = getStoredImages();
    const exists = images.some(e => getImageUrl(e) === imageUrl);
    if (!exists) {
        images.unshift({ url: imageUrl, width, height });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    }
}

function removeImage(imageUrl) {
    const images = getStoredImages();
    const filtered = images.filter(e => getImageUrl(e) !== imageUrl);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Migrate legacy string entries by detecting their dimensions
async function migrateStoredImages() {
    const images = getStoredImages();
    let needsSave = false;

    const migrated = await Promise.all(images.map(entry => {
        if (typeof entry === 'string') {
            needsSave = true;
            return detectDimensions(entry).then(dims => ({
                url: entry,
                width: dims.width,
                height: dims.height
            }));
        }
        return Promise.resolve(entry);
    }));

    if (needsSave) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        console.log('[Storage] Migrated legacy entries with dimensions');
    }
    return migrated;
}

// Detect dimensions via tiny JPEG thumbnail
function detectDimensions(url) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn('[Detect] Timeout:', url.slice(-25));
            resolve({ width: 1920, height: 1080 }); // default landscape
        }, 10000);

        const img = new Image();
        img.onload = () => {
            clearTimeout(timer);
            console.log('[Detect]', img.naturalWidth, 'x', img.naturalHeight, url.slice(-25));
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            clearTimeout(timer);
            console.warn('[Detect] Error loading:', url.slice(-25));
            resolve({ width: 1920, height: 1080 });
        };
        // Tiny JPEG — no f_auto, no crossOrigin — most compatible
        img.src = url.replace('/upload/', '/upload/c_scale,w_10,f_jpg/');
    });
}

// ============================================
// Cloudinary Upload Widget
// ============================================
let uploadWidget;

function initUploadWidget() {
    uploadWidget = cloudinary.createUploadWidget(
        {
            cloudName: CLOUDINARY_CLOUD_NAME,
            uploadPreset: CLOUDINARY_UPLOAD_PRESET,
            sources: ['local', 'camera'],
            multiple: true,
            maxFiles: 10,
            resourceType: 'image',
            clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            maxFileSize: 10000000,
            tags: ['thesis-26'],
            styles: {
                palette: {
                    window: '#161616',
                    windowBorder: '#3a3a3a',
                    tabIcon: '#f0ece4',
                    menuIcons: '#8a8a8a',
                    textDark: '#f0ece4',
                    textLight: '#f0ece4',
                    link: '#f0ece4',
                    action: '#d4d0c8',
                    inactiveTabIcon: '#8a8a8a',
                    error: '#cc0000',
                    inProgress: '#f0ece4',
                    complete: '#006600',
                    sourceBg: '#111111'
                },
                fonts: {
                    default: null,
                    "'Outfit', sans-serif": {
                        url: "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900",
                        active: true
                    }
                }
            }
        },
        (error, result) => {
            if (error) {
                console.error('Upload error:', error);
                return;
            }
            if (result.event === 'success') {
                const info = result.info;
                console.log('Upload successful:', info.secure_url, info.width, 'x', info.height);
                saveImage(info.secure_url, info.width, info.height);
                addImageToGallery(info.secure_url);

                // Show notification in projection mode
                if (isProjectionMode) {
                    showNewUploadIndicator();
                }
            }
        }
    );
}

function openUploadWidget() {
    if (!uploadWidget) {
        initUploadWidget();
    }
    if (uploadWidget) {
        uploadWidget.open();
    }
}

// ============================================
// Navigation
// ============================================
function showSection(sectionName) {
    // Hide all sections
    uploadSection.classList.remove('active');
    archiveSection.classList.remove('active');

    // Update nav links
    navLinks.forEach(link => link.classList.remove('active'));

    // Show selected section
    if (sectionName === 'upload') {
        uploadSection.classList.add('active');
        if (isProjectionMode) toggleProjectionMode();
    } else if (sectionName === 'archive') {
        archiveSection.classList.add('active');
        if (isProjectionMode) toggleProjectionMode();
    } else if (sectionName === 'slideshow') {
        if (!isProjectionMode) toggleProjectionMode();
    }

    // Update active nav link
    const activeLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
    if (activeLink) activeLink.classList.add('active');
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        showSection(section);
    });
});

// ============================================
// Event Listeners
// ============================================
uploadButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openUploadWidget();
});

uploadArea.addEventListener('click', openUploadWidget);

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    openUploadWidget();
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Admin login: Ctrl+Shift+A
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isAdmin) {
            isAdmin = false;
            sessionStorage.removeItem('nostalgia-admin');
            document.body.classList.remove('admin-mode');
            loadGallery();
            return;
        }
        showAdminPrompt();
        return;
    }

    switch(e.key.toLowerCase()) {
        case 'escape':
            if (isProjectionMode) {
                showSection('archive');
            }
            break;
        case 'arrowright':
            if (isProjectionMode) {
                nextSlide();
            }
            break;
        case 'arrowleft':
            if (isProjectionMode) {
                prevSlide();
            }
            break;
    }
});

// ============================================
// Admin Mode
// ============================================
function showAdminPrompt() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-overlay';

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.innerHTML = `
        <p class="admin-title">Admin Access</p>
        <input type="password" class="admin-input" placeholder="Password" autocomplete="off" />
        <div class="admin-actions">
            <button class="admin-cancel">Cancel</button>
            <button class="admin-submit">Enter</button>
        </div>
        <p class="admin-error"></p>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('.admin-input');
    const error = modal.querySelector('.admin-error');
    const submitBtn = modal.querySelector('.admin-submit');
    const cancelBtn = modal.querySelector('.admin-cancel');

    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        input.focus();
    });

    function tryLogin() {
        if (input.value === ADMIN_PASSWORD) {
            isAdmin = true;
            sessionStorage.setItem('nostalgia-admin', 'true');
            document.body.classList.add('admin-mode');
            closePrompt();
            loadGallery();
        } else {
            error.textContent = 'Incorrect password';
            input.value = '';
            input.focus();
        }
    }

    function closePrompt() {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
    }

    submitBtn.addEventListener('click', tryLogin);
    cancelBtn.addEventListener('click', closePrompt);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePrompt();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryLogin();
        if (e.key === 'Escape') closePrompt();
    });
}

function restoreAdminSession() {
    if (sessionStorage.getItem('nostalgia-admin') === 'true') {
        isAdmin = true;
        document.body.classList.add('admin-mode');
    }
}

// ============================================
// Gallery Functions
// ============================================
function addImageToGallery(imageUrl) {
    emptyMessage.classList.remove('visible');

    const item = document.createElement('div');
    item.className = 'gallery-item';

    const rand = Math.random();
    if (rand > 0.85) {
        item.classList.add('wide');
    } else if (rand > 0.7) {
        item.classList.add('tall');
    }

    const img = document.createElement('img');
    img.src = imageUrl.replace('/upload/', '/upload/c_fill,w_600,q_auto,f_auto/');
    img.alt = 'Uploaded memory';
    img.loading = 'lazy';

    item.appendChild(img);

    // Delete button — only added in admin mode
    if (isAdmin) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Remove from archive';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Remove this image from the archive?')) {
                removeImage(imageUrl);
                item.remove();
                if (getStoredImages().length === 0) {
                    emptyMessage.classList.add('visible');
                }
            }
        });
        item.appendChild(deleteBtn);
    }
    gallery.insertBefore(item, gallery.firstChild);
}

function loadGallery() {
    loading.classList.add('visible');
    emptyMessage.classList.remove('visible');
    gallery.innerHTML = '';

    const images = getStoredImages();

    if (images.length > 0) {
        images.forEach(entry => {
            addImageToGallery(getImageUrl(entry));
        });
    } else {
        emptyMessage.classList.add('visible');
    }

    loading.classList.remove('visible');
}

// ============================================
// Slideshow Functions
// ============================================
let slides = []; // Each slide: { type: 'landscape', url } or { type: 'portrait-group', urls: [] }

function toggleProjectionMode() {
    isProjectionMode = !isProjectionMode;
    document.body.classList.toggle('projection-mode', isProjectionMode);

    if (isProjectionMode) {
        startSlideshow();
        navLinks.forEach(link => link.classList.remove('active'));
        const slideshowLink = document.querySelector('.nav-link[data-section="slideshow"]');
        if (slideshowLink) slideshowLink.classList.add('active');
    } else {
        stopSlideshow();
    }
}

// Build slides using stored dimensions — no guessing
async function buildSlides() {
    // Migrate legacy entries first (adds width/height to old string-only entries)
    const images = await migrateStoredImages();
    if (images.length === 0) return [];

    const landscapes = [];
    const portraits = [];

    for (const entry of images) {
        const url = getImageUrl(entry);
        const portrait = (entry.height && entry.width) ? entry.height > entry.width : false;
        console.log('[Slideshow]', portrait ? 'PORTRAIT' : 'LANDSCAPE',
            `(${entry.width}x${entry.height})`, url.slice(-25));
        if (portrait) {
            portraits.push(url);
        } else {
            landscapes.push(url);
        }
    }

    console.log(`[Slideshow] ${landscapes.length} landscape, ${portraits.length} portrait`);

    // Group portraits into 2s and 3s — never leave one alone
    const portraitGroups = [];
    const total = portraits.length;
    let i = 0;

    while (i < total) {
        const remaining = total - i;
        if (remaining === 2 || remaining === 4) {
            portraitGroups.push({ type: 'portrait-group', urls: portraits.slice(i, i + 2) });
            i += 2;
        } else if (remaining >= 3) {
            portraitGroups.push({ type: 'portrait-group', urls: portraits.slice(i, i + 3) });
            i += 3;
        } else {
            // 1 remaining — still make it a portrait group
            portraitGroups.push({ type: 'portrait-group', urls: portraits.slice(i, i + 1) });
            i += 1;
        }
    }

    // Interleave portrait groups among landscape slides
    const built = [];
    let pIdx = 0;
    const interval = portraitGroups.length > 0
        ? Math.max(1, Math.floor(landscapes.length / (portraitGroups.length + 1)))
        : Infinity;

    for (let j = 0; j < landscapes.length; j++) {
        built.push({ type: 'landscape', url: landscapes[j] });
        if ((j + 1) % interval === 0 && pIdx < portraitGroups.length) {
            built.push(portraitGroups[pIdx++]);
        }
    }

    while (pIdx < portraitGroups.length) {
        built.push(portraitGroups[pIdx++]);
    }

    return built;
}

async function startSlideshow() {
    slideshowImage.innerHTML = '';
    slideshowImage.style.backgroundImage = 'none';

    slides = await buildSlides();

    if (slides.length === 0) {
        slideshowCounter.textContent = 'No images';
        return;
    }

    currentSlideIndex = 0;
    showSlide(currentSlideIndex);

    slideshowTimer = setInterval(() => {
        nextSlide();
    }, SLIDESHOW_INTERVAL);
}

function stopSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

function showSlide(index) {
    if (slides.length === 0) return;

    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    currentSlideIndex = index;

    const slide = slides[index];

    // Fade out
    slideshowImage.classList.add('fade-out');

    setTimeout(() => {
        slideshowImage.innerHTML = '';
        slideshowImage.style.backgroundImage = 'none';

        if (slide.type === 'landscape') {
            const optimized = slide.url.replace('/upload/', '/upload/c_fit,w_1920,h_1080,q_auto,f_auto/');
            slideshowImage.style.backgroundImage = `url('${optimized}')`;
            slideshowImage.classList.remove('portrait-layout');
        } else {
            // Portrait group — render as side-by-side images
            slideshowImage.classList.add('portrait-layout');
            slide.urls.forEach(url => {
                const img = document.createElement('img');
                img.src = url.replace('/upload/', '/upload/c_fill,w_640,h_1080,q_auto,f_auto/');
                img.alt = 'Memory';
                slideshowImage.appendChild(img);
            });
        }

        slideshowImage.classList.remove('fade-out');
    }, 750);

    slideshowCounter.textContent = `${index + 1} / ${slides.length}`;
}

function nextSlide() {
    showSlide(currentSlideIndex + 1);
}

function prevSlide() {
    showSlide(currentSlideIndex - 1);
}

function showNewUploadIndicator() {
    newUploadIndicator.classList.add('visible');
    setTimeout(() => {
        newUploadIndicator.classList.remove('visible');
    }, 3000);
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    restoreAdminSession();
    initUploadWidget();
    await migrateStoredImages();
    loadGallery();
});
