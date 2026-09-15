# 🐧 LMS Linux Indonesia & Virtual Lab

Platform **Learning Management System (LMS)** interaktif untuk mempelajari sistem operasi Linux dari dasar hingga mahir, dilengkapi dengan **Virtual Linux Lab** berbasis browser yang berjalan tanpa memerlukan instalasi mesin virtual atau Docker.

---

## 🌟 Fitur Utama

1. **Virtual Linux Lab Terintegrasi**:
   - Simulator terminal Linux dengan estetika modern (Ubuntu 24.04 LTS).
   - **Virtual File System (VFS)** in-memory lengkap dengan struktur standar FHS (`/bin`, `/etc`, `/home`, `/var/log`, `/tmp`, dll).
   - Mendukung manipulasi file, permission (mode oktal 755, 644, 600, dll), dan kepemilikan user (`chown`, `whoami`, `id`, `sudo`).
   - Eksekusi pipeline (`|`), pengalihan output (`>`, `>>`), dan command chaining (`&&`, `;`).
   - Autocomplete nama file dan perintah dengan tombol `[Tab]`.
   - Riwayat perintah (history) dengan tombol panah `[▲/▼]`.

2. **Editor Teks Nano In-Terminal**:
   - Editor teks mirip **GNU nano** interaktif di dalam browser.
   - Buka dengan `nano nama_file`, simpan dengan `Ctrl+O`, dan keluar dengan `Ctrl+X`.
   - Mendukung penulisan dan eksekusi skrip Bash (`.sh`).

3. **7 Modul Pembelajaran Terstruktur**:
   - **Modul 1**: Pengenalan Linux & Arsitektur FHS
   - **Modul 2**: Navigasi & Operasi File Dasar (`pwd`, `ls`, `cd`, `mkdir`, `cp`, `mv`, `rm`, `cat`)
   - **Modul 3**: Izin Akses (Permissions) & Manajemen User (`chmod`, `chown`, `sudo`, `whoami`)
   - **Modul 4**: Manipulasi Teks, Pipes, & Redirections (`grep`, `find`, `wc`, `sort`, `|`, `>`)
   - **Modul 5**: Monitoring Sistem & Manajemen Proses (`ps aux`, `top`, `kill`, `df`, `free`, `uptime`)
   - **Modul 6**: Jaringan & Manajemen Paket Software (`ping`, `curl`, `ip a`, `apt`)
   - **Modul 7**: Dasar Pemrograman Bash Scripting (Shebang, Variabel, If-Else, For Loop)

4. **Verifikasi Tugas Praktik Otomatis**:
   - Setiap modul memiliki checklist misi praktik lab.
   - Sistem secara otomatis memverifikasi status Virtual File System dan perintah terminal untuk memberikan centang hijau instan.

5. **Kuis Evaluasi Interaktif**:
   - Soal pilihan ganda di akhir setiap modul dengan skor langsung, pembahasan jawaban, dan penentuan kelulusan (minimal 70%).

6. **Tantangan Praktik CTF (Hands-on Missions)**:
   - 7 Misi tantangan dunia nyata (misal: perburuan file rahasia, audit log Apache/Nginx, penghentian proses liar cryptocurrency miner, audit pengguna `/etc/passwd`).

7. **Kamus & Cheatsheet Perintah**:
   - Ensiklopedia perintah Linux harian dengan pencarian instan dan tombol salin sintaks cepat.

8. **Sistem Akun & Autentikasi Multi-Peran (Siswa & Guru)**:
   - Database ringan bawaan **SQLite** (`database.db`) tanpa perlu instalasi database eksternal.
   - Kata sandi aman terenkripsi hash (`werkzeug.security`).
   - Sinkronisasi otomatis progres modul, kuis, dan poin dari browser ke database server (*Cloud Sync*).

9. **Dashboard Pemantauan Guru / Instruktur**:
   - Monitoring progres seluruh siswa di kelas secara real-time.
   - Rekapitulasi rata-rata nilai kuis, tugas lab, dan misi CTF yang diselesaikan.
   - Fitur pencarian siswa, filter status, dan **Ekspor Rekap Nilai ke format CSV/Excel**.

10. **Sertifikat Kelulusan Digital Terverifikasi**:
    - Menghasilkan sertifikat resmi yang langsung terhubung dengan akun siswa, nomor sertifikat unik, tanggal terbit, dan dukungan cetak langsung (Print to PDF).

---

## 🚀 Cara Menjalankan

### Prasyarat
- Python 3.8+ (Sudah terpasang di komputer Anda: Python 3.14)
- Library `Flask` (Sudah terpasang)

### Menjalankan Server
Buka terminal / PowerShell di direktori `coba`, lalu jalankan:

```bash
python run.py
```

atau menggunakan `app.py`:

```bash
python app.py
```

Aplikasi web akan otomatis dapat diakses melalui browser di alamat:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

### 🔑 Akun Demo Bawaan
Untuk menguji coba sistem secara instan, Anda dapat masuk menggunakan akun default berikut:
* **Akun Guru / Instruktur**:
  * Username: `guru`
  * Password: `guru123`
  * Akses: Portal Guru, monitoring seluruh siswa kelas, rekap nilai, ekspor CSV.
* **Akun Siswa Demo**:
  * Username: `siswa`
  * Password: `siswa123`
  * Akses: Modul belajar, terminal virtual, kuis, progres cloud, sertifikat.

### 🌐 Panduan Deployment di Server / Proxmox LXC
Untuk panduan instalasi lengkap di server produksi atau **LXC Container Proxmox VE** menggunakan Gunicorn, Nginx, dan Systemd auto-start, silakan baca dokumentasi terpisah di:  
👉 **[PANDUAN_PROXMOX_LXC.md](PANDUAN_PROXMOX_LXC.md)**

---

## 📁 Struktur Direktori

```text
H:\My Drive\PROYEK\coba\
├── app.py                     # Server Flask utama, rute, dan data kurikulum
├── db.py                      # Modul database SQLite & otentikasi user
├── database.db                # Database SQLite lokal (auto-created)
├── run.py                     # Runner script yang otomatis membuka browser
├── requirements.txt           # Dependensi Python (Flask & Gunicorn)
├── README.md                  # Dokumentasi panduan
├── PANDUAN_PROXMOX_LXC.md     # Panduan instalasi di LXC Container Proxmox VE
├── static/
│   ├── css/
│   │   ├── style.css          # Desain antarmuka modern & responsif (Auth & LMS)
│   │   ├── terminal.css       # Tema & styling terminal Linux
│   │   └── editor.css         # Styling editor teks nano in-terminal
│   └── js/
│       ├── vfs.js             # Simulator Virtual File System (VFS) in-memory
│       ├── shell.js           # Mesin interpreter perintah Linux & pipeline
│       ├── nano.js            # Simulator editor teks nano
│       ├── terminal.js        # Komponen UI terminal (input, cursor, history)
│       └── lms.js             # Engine LMS (tracking progres, sync server, kuis)
└── templates/
    ├── base.html              # Layout dasar dengan navbar auth & footer
    ├── login.html             # Halaman masuk siswa & guru
    ├── register.html          # Halaman pendaftaran akun baru
    ├── teacher_dashboard.html # Dashboard monitoring & rekapitulasi kelas guru
    ├── profile.html           # Profil siswa & status kelulusan modul
    ├── index.html             # Halaman beranda & ringkasan kurikulum
    ├── learn.html             # Mode belajar split-screen materi + virtual lab
    ├── lab.html               # Virtual lab sandbox penuh dengan pilihan skenario
    ├── challenges.html        # Misi praktik CTF dengan validasi otomatis
    ├── cheatsheet.html        # Kamus perintah Linux dengan pencarian instan
    └── certificate.html       # Generator sertifikat kelulusan resmi (cetak PDF)
```

---

## 💡 Perintah Linux yang Didukung di Virtual Lab

| Kategori | Perintah |
|---|---|
| **Navigasi** | `pwd`, `cd`, `ls` (`-l`, `-a`, `-la`, `-lh`), `tree` |
| **File & Direktori** | `touch`, `mkdir` (`-p`), `rmdir`, `cp` (`-r`), `mv`, `rm` (`-rf`) |
| **Membaca Teks** | `cat`, `head` (`-n`), `tail` (`-n`), `more`, `less` |
| **Pengolahan Teks** | `grep` (`-i`, `-v`, `-n`), `wc` (`-l`, `-w`, `-c`), `sort` (`-r`, `-n`), `uniq`, `find`, `echo` |
| **Izin & User** | `chmod` (755, 644, 600, +x, dll), `chown`, `whoami`, `id`, `groups`, `su`, `sudo` |
| **Sistem & Proses** | `ps aux`, `top`, `kill`, `killall`, `df -h`, `free -m`, `uptime`, `uname -a`, `date`, `hostname`, `history` |
| **Jaringan & Paket** | `ip a`, `ifconfig`, `ping`, `curl`, `apt update`, `apt install`, `neofetch` |
| **Editor & Skrip** | `nano <file>`, `./script.sh`, `bash <file>`, `sh <file>` |
| **Utilitas Shell** | Pipeline `|`, Redirection `>`, `>>`, `clear`, `help`, `man` |

---

Selamat belajar dan berlatih menguasai Linux! 🐧✨
