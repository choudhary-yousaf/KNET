// server.js
import 'dotenv/config';
import express from 'express';
// Import KNET routes from either `knet/knet-routes.js` or `knet-routes.js` in project root.
// This makes the server tolerant to deployments where files are uploaded into the
// repository root (no `knet/` subfolder).
let knetRoutes;
try {
	// prefer nested folder when present
	const mod = await import('./knet/knet-routes.js');
	knetRoutes = mod.default || mod;
} catch (e1) {
	try {
		const mod = await import('./knet-routes.js');
		knetRoutes = mod.default || mod;
	} catch (e2) {
		console.error('KNET routes module not found in ./knet/knet-routes.js or ./knet-routes.js');
		knetRoutes = null;
	}
}

const app = express();

app.use(express.json());
app.use(express.static('.'));

function buildAllowedOrigins() {
	const rawList = String(process.env.KNET_ALLOWED_ORIGINS || '').trim();
	if (!rawList) return [];
	return Array.from(new Set(rawList.split(',').map(origin => origin.trim()).filter(Boolean)));
}

const allowedOrigins = buildAllowedOrigins();

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Vary', 'Origin');
		res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	}

	if (req.method === 'OPTIONS') {
		return res.sendStatus(204);
	}

	next();
});

app.get('/api/health', (_req, res) => {
	res.json({ ok: true, service: 'knet-integration', timestamp: new Date().toISOString() });
});

// Mount KNET payment routes (if available)
if (knetRoutes) app.use('/api/knet', knetRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`KNET server running on ${port}`);
});