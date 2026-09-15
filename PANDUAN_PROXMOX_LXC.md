# 🐧 Panduan Instalasi & Deployment di LXC Proxmox VE
## LMS Linux Indonesia & Virtual Lab

Dokumen ini berisi panduan langkah demi langkah untuk menjalankan aplikasi **LinuxAcademy LMS** di lingkungan **LXC Container Proxmox VE** (Ubuntu 24.04 / 22.04 LTS atau Debian 12).

---

## 🖥️ 1. Spesifikasi Rekomendasi Container LXC

Aplikasi ini menggunakan engine simulasi terminal *in-browser* dan database SQLite lokal, sehingga sangat hemat sumber daya:

| Komponen | Spesifikasi Rekomendasi | Keterangan |
|---|---|---|
| **Template OS** | `ubuntu-24.04-standard` atau `debian-12-standard` | CT Template resmi Proxmox |
| **CPU Core** | 1 vCPU | Cukup untuk melayani 1 kelas siswa |
| **RAM / Memori**| 512 MB – 1 GB | 512 MB sudah sangat cukup |
| **Storage / Disk** | 6 GB – 10 GB | Tipe penyimpanan local-lvm / zfs |
| **Network** | DHCP atau Static IP (Bridge `vmbr0`) | Pastikan terhubung ke LAN sekolah/lab |
| **Mode Keamanan** | *Unprivileged Container* (Default) | Lebih aman dan stabil |

---

## 🚀 2. Langkah-Langkah Instalasi di Console LXC

Buka **Proxmox Web GUI** -> Pilih LXC Container Anda -> Buka menu **Console** (atau login via SSH):

### Langkah 1: Update Sistem & Pasang Paket Pendukung

```bash
apt update && apt upgrade -y
apt install -y git python3 python3-pip python3-venv nginx
```

---

### Langkah 2: Clone Repositori dari GitHub

Unduh source code proyek ke direktori sistem `/opt/linuxacademy`:

```bash
cd /opt
git clone https://github.com/kajurtkjsmkbp-hub/LinuxAcademy.git linuxacademy
cd /opt/linuxacademy
```

---

### Langkah 3: Siapkan Virtual Environment & Dependensi

Gunakan *Python Virtual Environment* agar pustaka aplikasi terisolasi dari sistem utama:

```bash
# Buat virtual environment
python3 -m venv venv

# Aktifkan virtual environment
source venv/bin/activate

# Install Flask dan Gunicorn (Production WSGI Server)
pip install -r requirements.txt
pip install gunicorn
```

---

### Langkah 4: Konfigurasi Systemd Service (Auto-Start saat Boot)

Agar aplikasi otomatis berjalan di latar belakang (*background service*) dan otomatis menyala kembali saat server/LXC dinyalakan (*reboot*):

1. Buat file service systemd:
   ```bash
   nano /etc/systemd/system/linuxacademy.service
   ```

2. Tempelkan isi konfigurasi berikut:
   ```ini
   [Unit]
   Description=LinuxAcademy LMS and Virtual Lab
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/opt/linuxacademy
   Environment="PATH=/opt/linuxacademy/venv/bin"
   ExecStart=/opt/linuxacademy/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 app:app
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```
   *(Simpan dengan menekan `Ctrl+O`, tekan `Enter`, lalu keluar dengan `Ctrl+X`)*

3. Muat ulang daemon dan jalankan service:
   ```bash
   systemctl daemon-reload
   systemctl enable --now linuxacademy
   ```

4. Verifikasi status service (pastikan berstatus `active (running)`):
   ```bash
   systemctl status linuxacademy
   ```

---

### Langkah 5: Konfigurasi Nginx Reverse Proxy (Akses Port 80 Standar)

Konfigurasikan Nginx agar siswa dan guru dapat mengakses web langsung melalui IP LXC tanpa harus menambahkan port `:5000`:

1. Buat berkas konfigurasi Nginx:
   ```bash
   nano /etc/nginx/sites-available/linuxacademy
   ```

2. Tempelkan isi konfigurasi berikut:
   ```nginx
   server {
       listen 80;
       server_name _;

       client_max_body_size 10M;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 90;
       }

       # Cache file statis CSS/JS untuk akses super cepat
       location /static/ {
           alias /opt/linuxacademy/static/;
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }
   }
   ```

3. Aktifkan konfigurasi situs dan hapus situs default Nginx:
   ```bash
   ln -s /etc/nginx/sites-available/linuxacademy /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   ```

4. Uji konfigurasi Nginx dan muat ulang:
   ```bash
   nginx -t
   systemctl restart nginx
   ```

---

## 🌐 3. Pengujian & Akses Aplikasi

1. Periksa alamat IP dari Container LXC Anda:
   ```bash
   ip a
   ```
2. Dari komputer klien/laptop siswa yang terhubung dalam satu jaringan LAN, buka peramban:
   ```text
   http://<IP-LXC-PROXMOX>
   ```
   *Contoh: `http://192.168.1.100`*

3. Sistem akan otomatis menampilkan **Halaman Login Wajib**:
   * **Akun Guru / Instruktur:**
     * Username: `guru`
     * Password: `guru123`
     * Akses: Portal Monitoring, Rekap Nilai Siswa, Ekspor CSV.
   * **Akun Siswa Demo:**
     * Username: `siswa`
     * Password: `siswa123`
     * Akses: Modul Pembelajaran, Terminal Virtual, Kuis, Sertifikat.

---

## 🔧 4. Perintah Pemeliharaan (Maintenance)

* **Melihat Log Aplikasi secara Real-time:**
  ```bash
  journalctl -u linuxacademy -f
  ```

* **Restart Layanan Aplikasi:**
  ```bash
  systemctl restart linuxacademy
  ```

* **Memperbarui Source Code ke Versi Terbaru dari GitHub:**
  ```bash
  cd /opt/linuxacademy
  git pull origin main
  systemctl restart linuxacademy
  ```

* **Mencadangkan (Backup) Database Siswa:**
  ```bash
  cp /opt/linuxacademy/database.db /opt/linuxacademy/database_backup_$(date +%F).db
  ```
