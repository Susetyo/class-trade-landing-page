/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [{ source: "/sw.js", headers: [
            { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
            { key: "Content-Type", value: "application/javascript; charset=utf-8" },
            { key: "Service-Worker-Allowed", value: "/" },
            { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ] }];
    },
    allowedDevOrigins: ["kenley-unblown-eileen.ngrok-free.dev"],
};

export default nextConfig;
