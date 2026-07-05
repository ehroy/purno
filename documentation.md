# Dokumentasi Instalasi dan Menjalankan Script

Dokumen ini menjelaskan cara menyiapkan proyek dari awal sampai menjalankan script yang tersedia.

## Prasyarat

- Node.js 18 atau lebih baru
- npm
- Koneksi internet
- Akun / API key CapSolver jika ingin menjalankan flow captcha
- Proxy opsional, jika dibutuhkan

## Instalasi dari Awal

1. Clone repository ini.
2. Masuk ke folder project.
3. Install dependency yang dipakai script:

```bash
npm install chalk undici @faker-js/faker axios tesseract.js
```

4. Buat file `.env` di root project jika ingin memakai konfigurasi tambahan.

Contoh isi `.env`:

```env
CAPSOLVER_API_KEY=ISI_API_KEY_CAPSOLVER
TURNSTILE_SITE_KEY=0x4AAAAAACDNCinYthKCTfgn
BASE_URL=https://loopdexplay.com
PROXY_URL=http://user:pass@host:port
# atau
HTTP_PROXY=http://user:pass@host:port
```

5. Siapkan file `device.txt`.

Format `device.txt`:

```txt
1234567890
2345678901
3456789012
```

Satu device number per baris.

## Menjalankan Script

Project ini tidak memakai `npm run start`, jadi jalankan langsung dengan `node`.

### 1. Register akun baru

```bash
node index.js
```

Saat dijalankan, script akan meminta jumlah akun yang ingin dibuat.

Hasil output akan disimpan ke:

- `accountnew.txt`

### 2. Login akun

```bash
node login.js
```

Script akan meminta path file input.

Format isi file input:

```txt
081234567890:password
081234567891:password
```

Yang dipakai script adalah nilai sebelum tanda `:`.

Hasil output akan disimpan ke:

- `accountlogin.txt`

### 3. Claim / ambil reward

```bash
node claim.js
```

Script akan meminta path file input.

Gunakan file hasil dari `index.js` atau `login.js`, karena `claim.js` membutuhkan data seperti `deviceNo` dan `sid`.

Contoh format baris yang dipakai:

```txt
phone:password:deviceNo:sid:cookie:wsToken
```

## Catatan Penting

- File `.env`, `accountlogin.txt`, dan `accountnew.txt` sudah di-ignore oleh git.
- Jika `CAPSOLVER_API_KEY` kosong, proses captcha akan gagal.
- Jika `device.txt` kosong atau tidak ada, script tidak bisa mengambil device number.
- `package.json` saat ini belum memiliki script npm, jadi jalankan file langsung dengan `node`.
- Saat script dimulai, akan tampil `IP direct` dan `IP via proxy` untuk validasi proxy.
- Proxy yang didukung dibaca dari `PROXY_URL`, `HTTP_PROXY`, `HTTPS_PROXY`, atau `ALL_PROXY`.
- `index.js` akan retry otomatis dengan device lain jika server menolak karena limit device harian.
- Jika `device.txt` habis, proses akan berhenti dan menampilkan jumlah device yang tersisa.

## Ringkasan Alur

1. Siapkan dependency.
2. Isi `.env`.
3. Isi `device.txt`.
4. Jalankan `node index.js` untuk register.
5. Jalankan `node login.js` untuk login.
6. Jalankan `node claim.js` untuk claim reward.
