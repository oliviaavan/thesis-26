// ============================================
// CONFIGURATION
// ============================================
const CLOUDINARY_CLOUD_NAME = 'dlfyn1oeq';
const CLOUDINARY_UPLOAD_PRESET = 'THESIS-26';
const SLIDESHOW_INTERVAL = 6000; // 6 seconds per image
const ASSET_MAX_DURATION = 3000; // max 3 seconds for videos/gifs
const PHOTO_EFFECTS = 'e_improve,e_auto_brightness,e_saturation:-40'; // normalize + desaturate per image

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
const newUploadIndicator = document.getElementById('newUploadIndicator');
const navLinks = document.querySelectorAll('.nav-link');
const uploadSection = document.getElementById('uploadSection');
const archiveSection = document.getElementById('archiveSection');
const siteHeader = document.getElementById('siteHeader');

// ============================================
// State
// ============================================
let slideshowTimer = null;
let currentSlideIndex = 0;
let isProjectionMode = false;
let isAdmin = false;
const ADMIN_PASSWORD = 'thesis26';

// ============================================
// Firebase Setup
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCh2Dww6jHkhbZtRRxis3wkAjDukNoT6ms",
    authDomain: "thesis-26.firebaseapp.com",
    databaseURL: "https://thesis-26-default-rtdb.firebaseio.com",
    projectId: "thesis-26",
    storageBucket: "thesis-26.firebasestorage.app",
    messagingSenderId: "780600080494",
    appId: "1:780600080494:web:56c9a38b07b4f643c64e7f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// Firebase Image Storage
// ============================================
function saveImage(imageUrl, width, height) {
    db.ref('images').push({ url: imageUrl, width, height, timestamp: Date.now() });
}

function removeImage(imageUrl) {
    db.ref('images').orderByChild('url').equalTo(imageUrl).once('value', snapshot => {
        snapshot.forEach(child => child.ref.remove());
    });
}

function fetchAllImages() {
    return new Promise((resolve) => {
        db.ref('images').orderByChild('timestamp').once('value', snapshot => {
            const data = snapshot.val();
            if (!data) return resolve([]);
            // newest first
            resolve(Object.values(data).reverse());
        });
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
            clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'],
            maxFileSize: 10000000,
            tags: ['thesis-26'],
            styles: {
                palette: {
                    window: '#111111',
                    windowBorder: '#3a3a3a',
                    windowShadow: 'rgba(0,0,0,0.8)',
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

    // Show/hide header (only visible on upload)
    siteHeader.style.display = sectionName === 'upload' ? '' : 'none';

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

// Mark header animation as done so it won't replay on navigation
const headerH1 = document.querySelector('header h1');
if (headerH1) {
    headerH1.addEventListener('animationend', () => {
        headerH1.classList.add('animation-done');
    });
}

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
    img.src = imageUrl.replace('/upload/', `/upload/c_fill,w_600,q_auto,f_auto,${PHOTO_EFFECTS}/`);
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
                if (gallery.querySelectorAll('.gallery-item').length === 0) {
                    emptyMessage.classList.add('visible');
                }
            }
        });
        item.appendChild(deleteBtn);
    }
    gallery.insertBefore(item, gallery.firstChild);
}

async function loadGallery() {
    loading.classList.add('visible');
    emptyMessage.classList.remove('visible');
    gallery.innerHTML = '';

    const images = await fetchAllImages();

    if (images.length > 0) {
        images.forEach(entry => addImageToGallery(entry.url));
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
    const images = await fetchAllImages();
    if (images.length === 0) return [];

    // Shuffle into random order
    for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
    }

    const landscapes = [];
    const portraits = [];

    for (const entry of images) {
        const url = entry.url;
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

    // Insert asset slides (video & gif) evenly throughout
    const assetSlides = [
        { type: 'video', src: 'assets/sunflare.mp4' },
        { type: 'video', src: 'assets/sunflare2.mp4' },
        { type: 'gif', src: 'assets/spiral.gif' },
        { type: 'gif', src: 'assets/lines.gif' },
        { type: 'gif', src: 'assets/tree.gif' },
        { type: 'gif', src: 'assets/wheat.gif' }
    ];

    if (built.length > 0) {
        const gap = Math.max(1, Math.floor(built.length / (assetSlides.length + 1)));
        for (let a = assetSlides.length - 1; a >= 0; a--) {
            const pos = Math.min(gap * (a + 1), built.length);
            built.splice(pos, 0, assetSlides[a]);
        }
    } else {
        built.push(...assetSlides);
    }

    return built;
}

async function startSlideshow() {
    slideshowImage.innerHTML = '';
    slideshowImage.style.backgroundImage = 'none';

    slides = await buildSlides();

    if (slides.length === 0) {
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
        slideshowImage.classList.remove('portrait-layout');

        if (slide.type === 'video') {
            // Video slide — play full-screen, advance after max 3s or when it ends
            clearInterval(slideshowTimer);
            slideshowTimer = null;
            const video = document.createElement('video');
            video.src = slide.src;
            video.className = 'slideshow-video';
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;
            let advanced = false;
            const advanceOnce = () => {
                if (advanced) return;
                advanced = true;
                video.pause();
                nextSlide();
                slideshowTimer = setInterval(() => nextSlide(), SLIDESHOW_INTERVAL);
            };
            video.addEventListener('ended', advanceOnce);
            setTimeout(advanceOnce, ASSET_MAX_DURATION);
            slideshowImage.appendChild(video);
        } else if (slide.type === 'gif') {
            // GIF slide — display full-screen for max 3s
            clearInterval(slideshowTimer);
            slideshowTimer = null;
            const img = document.createElement('img');
            img.src = slide.src;
            img.className = 'slideshow-video';
            img.alt = '';
            slideshowImage.appendChild(img);
            setTimeout(() => {
                nextSlide();
                slideshowTimer = setInterval(() => nextSlide(), SLIDESHOW_INTERVAL);
            }, ASSET_MAX_DURATION);
        } else if (slide.type === 'landscape') {
            if (!slideshowTimer) {
                slideshowTimer = setInterval(() => nextSlide(), SLIDESHOW_INTERVAL);
            }
            const optimized = slide.url.replace('/upload/', `/upload/c_fit,w_1920,h_1080,q_auto,f_auto,${PHOTO_EFFECTS}/`);
            slideshowImage.style.backgroundImage = `url('${optimized}')`;
        } else {
            // Portrait group — render as side-by-side images
            if (!slideshowTimer) {
                slideshowTimer = setInterval(() => nextSlide(), SLIDESHOW_INTERVAL);
            }
            slideshowImage.classList.add('portrait-layout');
            slide.urls.forEach(url => {
                const img = document.createElement('img');
                img.src = url.replace('/upload/', `/upload/c_fill,w_640,h_1080,q_auto,f_auto,${PHOTO_EFFECTS}/`);
                img.alt = 'Memory';
                slideshowImage.appendChild(img);
            });
        }

        slideshowImage.classList.remove('fade-out');
    }, 750);

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
document.addEventListener('DOMContentLoaded', () => {
    restoreAdminSession();
    initUploadWidget();
    loadGallery();
});
