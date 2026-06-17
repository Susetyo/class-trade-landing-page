# Synex Trade Academy — Next.js TypeScript Landing Page

Landing page kelas trading dengan visual dark premium fintech, dibuat dengan Next.js, TypeScript, Tailwind CSS, dan font Manrope.

> Catatan: desain ini dibuat sebagai versi original yang terinspirasi dari gaya visual dark fintech/premium. Tidak menggunakan aset atau file desain asli dari Dribbble.

## Cara menjalankan

```bash
npm install
npm run dev
```

Buka:

```txt
http://localhost:3000
```

## File utama

```txt
app/page.tsx       # Semua section landing page
app/layout.tsx     # Metadata + font Manrope
app/globals.css    # Global style, palette, animation
```

## Cara edit cepat

### Ganti nama brand
Cari teks berikut di `app/page.tsx`:

```txt
Synex Trade
Synex Trade Academy
```

### Ganti harga
Cari:

```txt
Rp499K
```

### Ganti email CTA
Cari:

```txt
hello@synextrade.id
```

### Ganti module kurikulum
Edit array:

```tsx
const modules = [...]
```

## Palette yang dipakai

```txt
#F1F3F3 — cream
#0E0C0A — dark background
#6C6662 — muted text
#827971 — taupe
#A5A4A1 — stone
#534C29 — olive dark
#8D8C59 — olive accent
#926C30 — bronze glow
```

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Login ke Vercel.
3. Import repository.
4. Deploy.

