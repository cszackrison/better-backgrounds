// Service Worker for Better Backgrounds PWA

// Bump this when the asset list changes so old caches are cleaned up
const CACHE_NAME = 'better-backgrounds-v2';

// Paths are relative to this file so the app also works when hosted in a subdirectory
const ASSETS = [
	'./',
	'./index.html',
	'./style.css',
	'./script.js',
	'./splash-screen.css',
	'./offline.html',
	'./favicon.ico',
	'./site.webmanifest',
	'./android-chrome-192x192.png',
	'./android-chrome-512x512.png',
	'./apple-touch-icon.png',
	'./favicon-16x16.png',
	'./favicon-32x32.png'
];

// Install event - cache all static assets and activate right away
self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

// Activate event - clean up old caches and take control of open pages
self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys()
			.then(keyList => Promise.all(
				keyList
					.filter(key => key !== CACHE_NAME)
					.map(key => caches.delete(key))
			))
			.then(() => self.clients.claim())
	);
});

// Fetch event - network first so updates are picked up, falling back to the cache offline
self.addEventListener('fetch', event => {
	const { request } = event;

	// Only handle same-origin GET requests; let everything else pass through untouched
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
		return;
	}

	event.respondWith(
		fetch(request)
			.then(response => {
				if (response && response.status === 200 && response.type === 'basic') {
					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
				}
				return response;
			})
			.catch(() => caches.match(request).then(cached => {
				if (cached) return cached;
				if (request.mode === 'navigate') {
					return caches.match('./offline.html');
				}
				return Response.error();
			}))
	);
});
