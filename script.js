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

// ============================================
// Local Storage for Image URLs
// ============================================
function getStoredImages() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveImage(imageUrl) {
    const images = getStoredImages();
    if (!images.includes(imageUrl)) {
        images.unshift(imageUrl);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    }
}

function removeImage(imageUrl) {
    const images = getStoredImages();
    const filtered = images.filter(url => url !== imageUrl);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
                console.log('Upload successful:', result.info.secure_url);
                saveImage(result.info.secure_url);
                addImageToGallery(result.info.secure_url);

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

    // Delete button for admin
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Remove from archive';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Remove this image from the archive?')) {
            removeImage(imageUrl);
            item.remove();
            // Show empty message if no images left
            if (getStoredImages().length === 0) {
                emptyMessage.classList.add('visible');
            }
        }
    });

    item.appendChild(img);
    item.appendChild(deleteBtn);
    gallery.insertBefore(item, gallery.firstChild);
}

function loadGallery() {
    loading.classList.add('visible');
    emptyMessage.classList.remove('visible');
    gallery.innerHTML = '';

    const images = getStoredImages();

    if (images.length > 0) {
        images.forEach(imageUrl => {
            addImageToGallery(imageUrl);
        });
    } else {
        emptyMessage.classList.add('visible');
    }

    loading.classList.remove('visible');
}

// ============================================
// Slideshow Functions
// ============================================
function toggleProjectionMode() {
    isProjectionMode = !isProjectionMode;
    document.body.classList.toggle('projection-mode', isProjectionMode);

    if (isProjectionMode) {
        startSlideshow();
        // Update nav state
        navLinks.forEach(link => link.classList.remove('active'));
        const slideshowLink = document.querySelector('.nav-link[data-section="slideshow"]');
        if (slideshowLink) slideshowLink.classList.add('active');
    } else {
        stopSlideshow();
    }
}

function startSlideshow() {
    const images = getStoredImages();
    if (images.length === 0) {
        slideshowImage.style.backgroundImage = 'none';
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
    const images = getStoredImages();
    if (images.length === 0) return;

    // Wrap around
    if (index >= images.length) index = 0;
    if (index < 0) index = images.length - 1;
    currentSlideIndex = index;

    const imageUrl = images[index];
    // Use larger Cloudinary transformation for projection
    const optimizedUrl = imageUrl.replace('/upload/', '/upload/c_fit,w_1920,h_1080,q_auto,f_auto/');

    // Fade transition
    slideshowImage.classList.add('fade-out');

    setTimeout(() => {
        slideshowImage.style.backgroundImage = `url('${optimizedUrl}')`;
        slideshowImage.classList.remove('fade-out');
    }, 750);

    // Update counter
    slideshowCounter.textContent = `${index + 1} / ${images.length}`;
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
    initUploadWidget();
    loadGallery();
});
