"""
Linux LMS & Virtual Lab Application Server
A comprehensive web-based Learning Management System with an in-browser Linux Terminal emulator.
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from functools import wraps
import json
import os
import db

app = Flask(__name__)
app.config['SECRET_KEY'] = 'linux-lms-super-secret-key-2026'

# Initialize SQLite database
db.init_db()

@app.context_processor
def inject_user():
    user_id = session.get('user_id')
    current_user = db.get_user_by_id(user_id) if user_id else None
    return dict(current_user=current_user)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Silakan masuk terlebih dahulu untuk mengakses halaman ini.', 'warning')
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated_function

def teacher_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            flash('Silakan masuk terlebih dahulu.', 'warning')
            return redirect(url_for('login', next=request.path))
        user = db.get_user_by_id(user_id)
        if not user or user.get('role') != 'guru':
            flash('Akses ditolak. Halaman Dashboard Guru hanya dapat diakses oleh akun Guru/Instruktur.', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

# Enforce login globally: Users must log in before accessing any learning or lab content
@app.before_request
def require_login_globally():
    # Allow static assets
    if request.path.startswith('/static/'):
        return None

    # Allow public auth routes
    if request.path in ['/login', '/register']:
        return None

    # If not logged in, redirect to login page
    if 'user_id' not in session:
        next_target = request.path if request.path not in ['/', '/login', '/logout'] else ''
        return redirect(url_for('login', next=next_target))

# Complete Curriculum Data in Indonesian
MODULES = [
    {
        "id": "modul-1",
        "slug": "pengenalan-linux",
        "order": 1,
        "title": "Pengenalan Linux & Arsitektur FHS",
        "summary": "Memahami sejarah singkat Linux, kernel vs shell, dan struktur hirarki direktori standar (FHS).",
        "duration": "25 menit",
        "level": "Pemula",
        "icon": "terminal",
        "sections": [
            {
                "title": "Apa itu Linux & Filosofi Unix?",
                "content": """
<p><strong>Linux</strong> adalah sistem operasi open-source berbasis kernel monolitik yang pertama kali dikembangkan oleh <em>Linus Torvalds</em> pada tahun 1991. Linux menerapkan filosofi desain Unix yang terkenal:</p>
<ul>
    <li><em>"Everything is a file"</em> (Semua entitas diwakili sebagai file, termasuk perangkat keras, socket, dan proses).</li>
    <li><em>"Small is beautiful"</em> (Program berukuran kecil yang fokus melakukan satu hal dengan sangat baik).</li>
    <li>Kombinasi program menggunakan <strong>Pipeline (<code>|</code>)</strong> untuk memecahkan masalah rumit.</li>
</ul>
<div class="callout callout-info">
    <div class="callout-title"><i class="bi bi-info-circle-fill"></i> Kernel vs Shell</div>
    <p><strong>Kernel</strong> adalah inti sistem operasi yang mengelola hardware (CPU, RAM, Disk). Sedangkan <strong>Shell</strong> (seperti Bash/Zsh) adalah antarmuka berbasis baris perintah (CLI) yang menerjemahkan instruksi pengguna ke kernel.</p>
</div>
"""
            },
            {
                "title": "Filesystem Hierarchy Standard (FHS)",
                "content": """
<p>Berbeda dengan Windows yang menggunakan drive letters seperti <code>C:\\</code> atau <code>D:\\</code>, Linux menggunakan satu pohon direktori tunggal yang berakar pada <strong>Root (<code>/</code>)</strong>.</p>
<table class="table table-dark table-striped table-hover">
    <thead>
        <tr><th>Direktori</th><th>Fungsi Utama</th></tr>
    </thead>
    <tbody>
        <tr><td><code>/</code></td><td>Root direktori, induk dari seluruh sistem file.</td></tr>
        <tr><td><code>/bin</code> & <code>/usr/bin</code></td><td>Biner program esensial pengguna (seperti <code>ls</code>, <code>cp</code>, <code>cat</code>).</td></tr>
        <tr><td><code>/sbin</code></td><td>Biner administratif khusus superuser (root).</td></tr>
        <tr><td><code>/etc</code></td><td>File konfigurasi sistem global (contoh: <code>/etc/passwd</code>, <code>/etc/hosts</code>).</td></tr>
        <tr><td><code>/home</code></td><td>Direktori pribadi pengguna biasa (contoh: <code>/home/student</code>).</td></tr>
        <tr><td><code>/root</code></td><td>Home direktori untuk superuser (root).</td></tr>
        <tr><td><code>/var</code></td><td>Data variabel dinamis seperti log (<code>/var/log</code>) dan cache.</td></tr>
        <tr><td><code>/tmp</code></td><td>File sementara yang dapat dihapus otomatis saat reboot.</td></tr>
        <tr><td><code>/dev</code> & <code>/proc</code></td><td>File perangkat virtual dan representasi proses kernel.</td></tr>
    </tbody>
</table>
"""
            },
            {
                "title": "Mengenal Prompt Shell",
                "content": """
<p>Saat terminal dibuka, Anda akan melihat baris prompt seperti ini:</p>
<div class="code-block">
    <code>student@linux-lab:~$ </code>
</div>
<ul>
    <li><code>student</code>: Nama user yang sedang aktif saat ini.</li>
    <li><code>linux-lab</code>: Nama host / komputer (hostname).</li>
    <li><code>~</code> (tilde): Singkatan dari home direktori user aktif (<code>/home/student</code>).</li>
    <li><code>$</code>: Menandakan hak akses user biasa (jika <code>#</code>, menandakan Anda adalah <strong>root</strong>).</li>
</ul>
<p>Uji coba di terminal sebelah kanan dengan mengetikkan:</p>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="whoami"><code>whoami</code> - Cek user aktif</button>
    <button class="btn-run-cmd" data-cmd="hostname"><code>hostname</code> - Cek nama mesin</button>
    <button class="btn-run-cmd" data-cmd="pwd"><code>pwd</code> - Cetak direktori kerja saat ini</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t1_pwd",
                "text": "Periksa direktori kerja saat ini menggunakan perintah <code>pwd</code>.",
                "check_type": "last_command",
                "expected": "pwd"
            },
            {
                "id": "t1_whoami",
                "text": "Ketahui identitas user yang sedang aktif dengan perintah <code>whoami</code>.",
                "check_type": "last_command",
                "expected": "whoami"
            },
            {
                "id": "t1_explore_root",
                "text": "Gunakan perintah <code>ls /</code> untuk melihat isi root direktori.",
                "check_type": "command_history",
                "expected": "ls /"
            }
        ],
        "quiz": [
            {
                "question": "Apakah simbol yang menandakan bahwa user yang aktif adalah Superuser (root)?",
                "options": ["$", "#", "~", "@"],
                "answer": 1,
                "explanation": "Simbol '#' pada prompt Linux menandakan user memiliki hak akses Superuser (root), sedangkan '$' untuk user biasa."
            },
            {
                "question": "Direktori manakah yang digunakan untuk menyimpan file konfigurasi sistem global di Linux?",
                "options": ["/bin", "/home", "/etc", "/var"],
                "answer": 2,
                "explanation": "/etc menyimpan seluruh konfigurasi sistem, daemon, dan aplikasi global."
            },
            {
                "question": "Arti dari tanda tilde (~) pada prompt shell Linux adalah:",
                "options": [
                    "Root direktori (/)",
                    "Home direktori pengguna aktif (/home/username)",
                    "Direktori sementara (/tmp)",
                    "Direktori biner (/bin)"
                ],
                "answer": 1,
                "explanation": "~ adalah alias shorcut menuju home directory user yang sedang login."
            }
        ]
    },
    {
        "id": "modul-2",
        "slug": "navigasi-dan-operasi-file",
        "order": 2,
        "title": "Navigasi & Operasi File Dasar",
        "summary": "Menguasai navigasi pohon direktori (cd, pwd, ls) serta manajemen file dan folder (mkdir, touch, cp, mv, rm, cat).",
        "duration": "35 menit",
        "level": "Pemula",
        "icon": "folder",
        "sections": [
            {
                "title": "Navigasi Direktori: pwd, ls, dan cd",
                "content": """
<p>Dalam terminal, Anda selalu berada di suatu lokasi yang disebut <strong>Current Working Directory</strong>.</p>
<ul>
    <li><code>pwd</code> (<em>Print Working Directory</em>): Menampilkan path absolut direktori saat ini.</li>
    <li><code>ls</code> (<em>List</em>): Menampilkan daftar file dan folder.
        <ul>
            <li><code>ls -l</code>: Format panjang (detail permission, ukuran, tanggal modifikasi).</li>
            <li><code>ls -a</code>: Menampilkan seluruh file termasuk file tersembunyi (diawali titik <code>.</code>).</li>
            <li><code>ls -la</code> atau <code>ls -lh</code>: Kombinasi detail panjang dengan format ukuran human-readable.</li>
        </ul>
    </li>
    <li><code>cd</code> (<em>Change Directory</em>): Berpindah direktori.
        <ul>
            <li><code>cd /var/log</code>: Path absolut (dimulai dari <code>/</code>).</li>
            <li><code>cd documents</code>: Path relatif (berdasarkan lokasi saat ini).</li>
            <li><code>cd ..</code>: Naik 1 tingkat ke direktori induk (parent directory).</li>
            <li><code>cd ~</code> atau <code>cd</code> saja: Kembali ke home direktori.</li>
            <li><code>cd -</code>: Berpindah ke direktori sebelumnya (toggle).</li>
        </ul>
    </li>
</ul>
"""
            },
            {
                "title": "Membuat & Memanipulasi File/Folder",
                "content": """
<p>Berikut perintah esensial untuk operasi file:</p>
<ul>
    <li><code>mkdir nama_folder</code>: Membuat direktori baru. Gunakan opsi <code>mkdir -p parent/child</code> untuk membuat subdirektori bersarang sekaligus.</li>
    <li><code>touch nama_file.txt</code>: Membuat file kosong baru atau memperbarui timestamp.</li>
    <li><code>cp sumber tujuan</code>: Menyalin (copy) file. Gunakan opsi <code>cp -r</code> untuk menyalin folder secara rekursif.</li>
    <li><code>mv sumber tujuan</code>: Memindahkan (move) atau mengganti nama (rename) file/folder.</li>
    <li><code>rm nama_file</code>: Menghapus file.
        <div class="callout callout-warning">
            <div class="callout-title"><i class="bi bi-exclamation-triangle-fill"></i> Perhatian: Tidak Ada Recycle Bin!</div>
            <p>Di Linux CLI, perintah <code>rm</code> menghapus file secara permanen. Untuk menghapus direktori beserta isinya gunakan <code>rm -r folder</code> atau <code>rm -rf folder</code> dengan sangat berhati-hati!</p>
        </div>
    </li>
</ul>
"""
            },
            {
                "title": "Membaca Isi File: cat, head, tail",
                "content": """
<p>Ada beberapa cara untuk membaca isi file di terminal tanpa membuka editor:</p>
<ul>
    <li><code>cat file.txt</code>: Menampilkan seluruh isi file sekaligus ke layar.</li>
    <li><code>head -n 5 file.txt</code>: Menampilkan 5 baris pertama dari file.</li>
    <li><code>tail -n 5 file.txt</code>: Menampilkan 5 baris terakhir dari file. Sangat populer untuk membaca log terbaru.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="cat /etc/os-release"><code>cat /etc/os-release</code> - Baca info distro Linux</button>
    <button class="btn-run-cmd" data-cmd="head -n 3 /etc/passwd"><code>head -n 3 /etc/passwd</code> - Lihat 3 baris awal /etc/passwd</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t2_mkdir",
                "text": "Buat direktori bernama <code>proyek_web</code> di home direktori Anda (<code>mkdir proyek_web</code>).",
                "check_type": "file_exists",
                "path": "/home/student/proyek_web",
                "is_dir": True
            },
            {
                "id": "t2_touch",
                "text": "Buat file baru bernama <code>index.html</code> di dalam direktori <code>proyek_web</code>.",
                "check_type": "file_exists",
                "path": "/home/student/proyek_web/index.html",
                "is_dir": False
            },
            {
                "id": "t2_copy",
                "text": "Salin file <code>/home/student/proyek_web/index.html</code> ke <code>/home/student/proyek_web/backup.html</code>.",
                "check_type": "file_exists",
                "path": "/home/student/proyek_web/backup.html",
                "is_dir": False
            }
        ],
        "quiz": [
            {
                "question": "Opsi manakah pada perintah 'ls' yang digunakan untuk melihat file tersembunyi (hidden files)?",
                "options": ["ls -h", "ls -l", "ls -a", "ls -x"],
                "answer": 2,
                "explanation": "Opsi '-a' (all) menampilkan semua file, termasuk yang diawali titik (hidden file)."
            },
            {
                "question": "Perintah apa yang digunakan untuk naik satu tingkat ke direktori di atasnya?",
                "options": ["cd .", "cd ..", "cd /", "cd -"],
                "answer": 1,
                "explanation": "'..' merepresentasikan direktori parent (induk)."
            },
            {
                "question": "Flag apa yang wajib ditambahkan pada perintah 'cp' untuk menyalin sebuah folder beserta seluruh isinya?",
                "options": ["-f", "-r", "-a", "-v"],
                "answer": 1,
                "explanation": "Flag '-r' atau '-R' (rekursif) diperlukan untuk menyalin struktur folder beserta isinya."
            }
        ]
    },
    {
        "id": "modul-3",
        "slug": "hak-akses-dan-manajemen-user",
        "order": 3,
        "title": "Izin Akses (Permissions) & Manajemen User",
        "summary": "Memahami model keamanan Linux: hak akses Read, Write, Execute, notasi numerik chmod, kepemilikan chown, dan superuser sudo.",
        "duration": "30 menit",
        "level": "Menengah",
        "icon": "shield-lock",
        "sections": [
            {
                "title": "Struktur Izin Akses (File Permissions)",
                "content": """
<p>Linux adalah sistem multi-pengguna. Setiap file dan direktori dilindungi oleh matriks hak akses 3 tingkat:</p>
<ol>
    <li><strong>User / Owner (u)</strong>: Pengguna pemilik file.</li>
    <li><strong>Group (g)</strong>: Kelompok pengguna yang memiliki hak atas file.</li>
    <li><strong>Others (o)</strong>: Semua pengguna lain dalam sistem.</li>
</ol>
<p>Ketik <code>ls -l</code> untuk melihat string permission 10 karakter, contoh: <code>-rwxr-xr--</code></p>
<ul>
    <li>Karakter ke-1: Jenis file (<code>-</code> file biasa, <code>d</code> direktori, <code>l</code> symbolic link).</li>
    <li>Karakter ke-2..4 (<code>rwx</code>): Hak akses untuk <strong>Owner</strong>.</li>
    <li>Karakter ke-5..7 (<code>r-x</code>): Hak akses untuk <strong>Group</strong>.</li>
    <li>Karakter ke-8..10 (<code>r--</code>): Hak akses untuk <strong>Others</strong>.</li>
</ul>
<table class="table table-dark table-bordered">
    <thead>
        <tr><th>Izin</th><th>Arti pada File</th><th>Arti pada Direktori</th><th>Nilai Oktal</th></tr>
    </thead>
    <tbody>
        <tr><td><code>r</code> (read)</td><td>Membaca isi file</td><td>Melihat daftar isi direktori (ls)</td><td><strong>4</strong></td></tr>
        <tr><td><code>w</code> (write)</td><td>Mengubah/menyimpan file</td><td>Membuat/menghapus file dalam direktori</td><td><strong>2</strong></td></tr>
        <tr><td><code>x</code> (execute)</td><td>Menjalankan file sebagai program</td><td>Memasuki direktori (cd)</td><td><strong>1</strong></td></tr>
    </tbody>
</table>
"""
            },
            {
                "title": "Mengubah Izin dengan chmod (Metode Numerik & Simbolik)",
                "content": """
<p><strong>Metode Numerik (Octal Mode):</strong> Menjumlahkan nilai r (4) + w (2) + x (1) untuk setiap kategori.</p>
<ul>
    <li><code>chmod 755 script.sh</code> &rarr; Owner: 4+2+1=<strong>7</strong> (rwx), Group: 4+1=<strong>5</strong> (r-x), Others: 4+1=<strong>5</strong> (r-x). Standar untuk skrip eksekusi publik.</li>
    <li><code>chmod 644 document.txt</code> &rarr; Owner: 4+2=<strong>6</strong> (rw-), Group: 4 (r--), Others: 4 (r--). Standar untuk file teks normal.</li>
    <li><code>chmod 600 id_rsa</code> &rarr; Owner: 6 (rw-), Group: 0 (---), Others: 0 (---). Standar untuk private key yang sangat rahasia.</li>
</ul>
<p><strong>Metode Simbolik:</strong></p>
<ul>
    <li><code>chmod +x script.sh</code> &rarr; Memberi izin execute ke semua pihak.</li>
    <li><code>chmod u+w,go-w file.txt</code> &rarr; Tambah write untuk owner, cabut write untuk group dan others.</li>
</ul>
"""
            },
            {
                "title": "Kepemilikan (chown) dan Superuser (sudo)",
                "content": """
<ul>
    <li><code>chown user:group file</code>: Mengganti pemilik dan grup pemilik file (memerlukan hak root).</li>
    <li><code>sudo command</code> (<em>SuperUser DO</em>): Menjalankan perintah dengan hak akses administrator sementara.</li>
    <li><code>whoami</code> & <code>id</code>: Menampilkan identitas user dan ID grup yang sedang aktif.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="id"><code>id</code> - Lihat UID, GID, dan grup user saat ini</button>
    <button class="btn-run-cmd" data-cmd="ls -l /etc/passwd"><code>ls -l /etc/passwd</code> - Periksa hak akses file /etc/passwd</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t3_touch_script",
                "text": "Buat file skrip bernama <code>run.sh</code> di home direktori (<code>touch /home/student/run.sh</code>).",
                "check_type": "file_exists",
                "path": "/home/student/run.sh",
                "is_dir": False
            },
            {
                "id": "t3_chmod_exec",
                "text": "Ubah izin file <code>/home/student/run.sh</code> menjadi executable (misal: <code>chmod 755 run.sh</code> atau <code>chmod +x run.sh</code>).",
                "check_type": "file_permission",
                "path": "/home/student/run.sh",
                "has_exec": True
            },
            {
                "id": "t3_chmod_secret",
                "text": "Buat file <code>rahasia.txt</code> dengan izin akses ketat <code>600</code> (hanya owner yang bisa membaca dan menulis).",
                "check_type": "file_mode",
                "path": "/home/student/rahasia.txt",
                "expected_mode": "600"
            }
        ],
        "quiz": [
            {
                "question": "Berapakah representasi nilai numerik oktal untuk izin akses Read (r) dan Write (w)?",
                "options": ["3", "5", "6", "7"],
                "answer": 2,
                "explanation": "Read = 4, Write = 2. Maka 4 + 2 = 6."
            },
            {
                "question": "Izin akses 755 pada sebuah file berarti:",
                "options": [
                    "Semua orang memiliki hak penuh rwx",
                    "Owner: rwx, Group: r-x, Others: r-x",
                    "Owner: rw-, Group: r--, Others: ---",
                    "Hanya root yang dapat membaca file"
                ],
                "answer": 1,
                "explanation": "7 = rwx (4+2+1), 5 = r-x (4+0+1), 5 = r-x (4+0+1)."
            },
            {
                "question": "Perintah apa yang digunakan untuk mengubah kepemilikan user dan group atas suatu file?",
                "options": ["chmod", "chown", "chgrp", "passwd"],
                "answer": 1,
                "explanation": "chown (Change Owner) digunakan untuk mengubah pemilik user dan grup file."
            }
        ]
    },
    {
        "id": "modul-4",
        "slug": "text-processing-dan-piping",
        "order": 4,
        "title": "Manipulasi Teks, Pipes, & Redirections",
        "summary": "Kekuatan sejati Linux: menggabungkan utilitas pencarian teks (grep, find, wc, sort) menggunakan pipeline (|) dan pengalihan I/O.",
        "duration": "35 menit",
        "level": "Menengah",
        "icon": "filter",
        "sections": [
            {
                "title": "Standar Streams & I/O Redirection (>, >>, <)",
                "content": """
<p>Setiap program Linux memiliki 3 kanal komunikasi standar:</p>
<ul>
    <li><strong>stdin (0)</strong>: Standard Input (keyboard).</li>
    <li><strong>stdout (1)</strong>: Standard Output (layar).</li>
    <li><strong>stderr (2)</strong>: Standard Error (layar pesan kesalahan).</li>
</ul>
<p>Kita dapat mengalihkan aliran output ini ke file menggunakan operator redirection:</p>
<ul>
    <li><code>command > file.txt</code>: Menulis output ke file (<strong>Menimpa/Overwrite</strong> isi sebelumnya).</li>
    <li><code>command >> file.txt</code>: Menambahkan output ke baris paling akhir file (<strong>Append</strong>).</li>
    <li><code>command < file.txt</code>: Membaca input dari file.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="echo 'Server started at 12:00' > server.log"><code>echo '...' > server.log</code> - Tulis ke file</button>
    <button class="btn-run-cmd" data-cmd="echo 'User logged in at 12:05' >> server.log"><code>echo '...' >> server.log</code> - Tambahkan baris baru</button>
    <button class="btn-run-cmd" data-cmd="cat server.log"><code>cat server.log</code> - Periksa hasilnya</button>
</div>
"""
            },
            {
                "title": "Pipeline ( | ): Menghubungkan Perintah",
                "content": """
<p>Operator pipa (<code>|</code>) mengambil <em>stdout</em> dari perintah di sebelah kiri dan mengirimkannya sebagai <em>stdin</em> ke perintah di sebelah kanan.</p>
<div class="code-block">
    <code>cat /var/log/syslog | grep "ERROR" | wc -l</code>
</div>
<p>Contoh di atas membaca log sistem, memfilter hanya baris yang mengandung kata "ERROR", lalu menghitung berapa jumlah baris error tersebut secara otomatis!</p>
"""
            },
            {
                "title": "Utilitas Teks Penting: grep, wc, sort, uniq, find",
                "content": """
<ul>
    <li><code>grep "pola" file</code>: Mencari kata/regex dalam file.
        <ul>
            <li><code>grep -i</code>: Case-insensitive (abaikan huruf besar/kecil).</li>
            <li><code>grep -v</code>: Invert match (tampilkan yang TIDAK cocok).</li>
            <li><code>grep -n</code>: Tampilkan nomor baris temuan.</li>
        </ul>
    </li>
    <li><code>wc file</code> (<em>Word Count</em>): Menghitung baris (<code>-l</code>), kata (<code>-w</code>), dan karakter (<code>-c</code>).</li>
    <li><code>sort file</code>: Mengurutkan baris secara alfabetik (atau numerik dengan <code>-n</code>).</li>
    <li><code>uniq</code>: Menghapus baris duplikat yang berurutan (biasanya dikombinasikan dengan <code>sort</code>).</li>
    <li><code>find /path -name "*.txt"</code>: Mencari file/folder berdasarkan nama, tipe, atau ukuran.</li>
</ul>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t4_redirect",
                "text": "Buat file <code>catatan.txt</code> berisi teks 'Belajar Linux Sangat Menyenangkan' menggunakan redirection <code>echo ... > catatan.txt</code>.",
                "check_type": "file_content",
                "path": "/home/student/catatan.txt",
                "contains": "Belajar Linux"
            },
            {
                "id": "t4_grep_log",
                "text": "Cari kata 'ERROR' pada file <code>/var/log/syslog</code> menggunakan perintah <code>grep 'ERROR' /var/log/syslog</code>.",
                "check_type": "command_history",
                "expected": "grep"
            },
            {
                "id": "t4_save_pipe",
                "text": "Filter kata 'student' dari <code>/etc/passwd</code> dan simpan outputnya ke <code>/home/student/hasil_cari.txt</code>.",
                "check_type": "file_exists",
                "path": "/home/student/hasil_cari.txt",
                "is_dir": False
            }
        ],
        "quiz": [
            {
                "question": "Operator redirection apa yang digunakan untuk menambahkan teks ke baris akhir file tanpa menghapus isi lamanya?",
                "options": [">", ">>", "<", "|"],
                "answer": 1,
                "explanation": "Operator '>>' melakukan append (menambahkan ke akhir file), sedangkan '>' melakukan overwrite."
            },
            {
                "question": "Fungsi operator pipeline (|) dalam shell Linux adalah:",
                "options": [
                    "Menghubungkan komputer ke jaringan internet",
                    "Mengalirkan output dari perintah pertama sebagai input perintah kedua",
                    "Menghentikan proses yang sedang berjalan",
                    "Membuat file salinan baru"
                ],
                "answer": 1,
                "explanation": "Pipeline (|) mengalirkan stdout dari perintah kiri menjadi stdin perintah kanan."
            },
            {
                "question": "Perintah apa yang digunakan untuk menghitung jumlah total baris dalam sebuah file teks?",
                "options": ["wc -l", "wc -w", "grep -c", "count -l"],
                "answer": 0,
                "explanation": "wc -l (Word Count - Lines) menghitung jumlah baris dalam file."
            }
        ]
    },
    {
        "id": "modul-5",
        "slug": "manajemen-proses-dan-sistem",
        "order": 5,
        "title": "Monitoring Sistem & Manajemen Proses",
        "summary": "Memantau sumber daya CPU, RAM, Disk, serta mengendalikan lifecycle proses Linux (ps, top, kill, df, free, uptime).",
        "duration": "30 menit",
        "level": "Menengah",
        "icon": "cpu",
        "sections": [
            {
                "title": "Konsep Proses & PID (Process ID)",
                "content": """
<p>Setiap program atau perintah yang berjalan di Linux disebut <strong>Proses</strong>. Setiap proses memiliki identitas unik berupa nomor bilangan bulat positif yang disebut <strong>PID (Process ID)</strong>.</p>
<p>Proses nomor 1 adalah <code>systemd</code> (atau <code>init</code>), yang menjadi leluhur (parent) dari seluruh proses lain di sistem operasi.</p>
"""
            },
            {
                "title": "Melihat Proses: ps dan top",
                "content": """
<ul>
    <li><code>ps aux</code>: Menampilkan seluruh proses yang sedang berjalan di sistem beserta penggunaan CPU, memori, user pemilik, dan statusnya.
        <ul>
            <li><code>a</code>: Semua proses termasuk milik user lain.</li>
            <li><code>u</code>: Format berorientasi user (lengkap dengan info %CPU, %MEM).</li>
            <li><code>x</code>: Termasuk proses yang berjalan di latar belakang (daemon) tanpa terminal tty.</li>
        </ul>
    </li>
    <li><code>top</code>: Utilitas interaktif waktu-nyata (real-time task manager) untuk memonitor beban kerja CPU, RAM, dan daftar proses terberat.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="ps aux"><code>ps aux</code> - Daftar seluruh proses aktif</button>
    <button class="btn-run-cmd" data-cmd="top"><code>top</code> - Monitor sistem real-time</button>
</div>
"""
            },
            {
                "title": "Menghentikan Proses (Signals & kill)",
                "content": """
<p>Kita dapat mengirim sinyal ke proses menggunakan perintah <code>kill</code> diikuti oleh PID-nya:</p>
<ul>
    <li><code>kill 1234</code>: Mengirim sinyal <code>SIGTERM (15)</code> yang meminta proses berhenti secara elegan (menyimpan data sebelum keluar).</li>
    <li><code>kill -9 1234</code>: Mengirim sinyal <code>SIGKILL (9)</code> yang memaksa proses berhenti seketika tanpa kompromi. Gunakan hanya jika proses macet/hang.</li>
    <li><code>killall nama_program</code>: Menghentikan seluruh proses berdasarkan nama programnya.</li>
</ul>
"""
            },
            {
                "title": "Memantau Disk, Memori, & Waktu Hidup Sistem",
                "content": """
<ul>
    <li><code>df -h</code> (<em>Disk Free</em>): Melihat sisa ruang penyimpanan di seluruh partisi dengan satuan yang mudah dibaca (Gigabyte/Megabyte).</li>
    <li><code>free -m</code>: Memeriksa penggunaan kapasitas RAM dan Swap dalam satuan Megabyte.</li>
    <li><code>uptime</code>: Menampilkan sudah berapa lama sistem menyala dan beban rata-rata (load average).</li>
    <li><code>uname -a</code>: Menampilkan informasi lengkap kernel dan arsitektur mesin.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="df -h"><code>df -h</code> - Cek kapasitas partisi disk</button>
    <button class="btn-run-cmd" data-cmd="free -m"><code>free -m</code> - Cek pemakaian memori RAM</button>
    <button class="btn-run-cmd" data-cmd="uptime"><code>uptime</code> - Cek durasi aktif mesin</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t5_ps",
                "text": "Jalankan perintah <code>ps aux</code> untuk melihat daftar proses yang sedang berjalan di lab.",
                "check_type": "last_command",
                "expected": "ps"
            },
            {
                "id": "t5_free",
                "text": "Periksa penggunaan memori RAM sistem menggunakan perintah <code>free -m</code>.",
                "check_type": "command_history",
                "expected": "free"
            },
            {
                "id": "t5_df",
                "text": "Periksa status partisi penyimpanan disk dengan opsi human-readable <code>df -h</code>.",
                "check_type": "command_history",
                "expected": "df -h"
            }
        ],
        "quiz": [
            {
                "question": "Nomor sinyal (signal) berapakah yang dikirim oleh perintah 'kill -9' untuk mematikan proses secara paksa?",
                "options": ["SIGTERM (15)", "SIGINT (2)", "SIGKILL (9)", "SIGHUP (1)"],
                "answer": 2,
                "explanation": "kill -9 mengirimkan sinyal SIGKILL (signal 9) yang menghentikan proses seketika."
            },
            {
                "question": "Perintah manakah yang paling tepat untuk memeriksa ruang kosong pada media penyimpanan disk?",
                "options": ["free -m", "df -h", "du -sh", "fdisk -l"],
                "answer": 1,
                "explanation": "df (Disk Free) menampilkan ringkasan penggunaan partisi disk, opsi -h membuatnya mudah dibaca (GB/MB)."
            },
            {
                "question": "Apakah yang dimaksud dengan PID pada sistem operasi Linux?",
                "options": [
                    "Password Identity",
                    "Process Identifier",
                    "Program Index Directory",
                    "Protected Interface Driver"
                ],
                "answer": 1,
                "explanation": "PID singkatan dari Process Identifier, nomor identitas unik setiap proses yang aktif."
            }
        ]
    },
    {
        "id": "modul-6",
        "slug": "manajemen-paket-dan-jaringan",
        "order": 6,
        "title": "Jaringan & Manajemen Paket Software",
        "summary": "Mengeksplorasi utilitas jaringan dasar (ping, curl, ip a, ifconfig) serta instalasi software menggunakan Advanced Package Tool (apt).",
        "duration": "30 menit",
        "level": "Menengah",
        "icon": "globe",
        "sections": [
            {
                "title": "Manajemen Paket dengan APT (Debian/Ubuntu)",
                "content": """
<p>Linux menggunakan repositori terpusat untuk mendistribusikan software dengan aman. Di distro berbasis Debian (seperti Ubuntu), kita menggunakan <code>apt</code> (<em>Advanced Package Tool</em>):</p>
<ul>
    <li><code>sudo apt update</code>: Memperbarui daftar katalog paket terbaru dari server repositori.</li>
    <li><code>sudo apt upgrade</code>: Memperbarui seluruh paket software yang telah terinstal ke versi paling baru.</li>
    <li><code>sudo apt install nama_paket</code>: Mengunduh dan menginstal software beserta seluruh dependensinya.</li>
    <li><code>sudo apt remove nama_paket</code>: Menghapus paket software dari sistem.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="apt update"><code>apt update</code> - Update daftar indeks repositori</button>
    <button class="btn-run-cmd" data-cmd="apt install neofetch"><code>apt install neofetch</code> - Pasang alat neofetch</button>
    <button class="btn-run-cmd" data-cmd="neofetch"><code>neofetch</code> - Tampilkan logo dan spesifikasi sistem</button>
</div>
"""
            },
            {
                "title": "Utilitas Jaringan: ping, curl, ip a",
                "content": """
<ul>
    <li><code>ping host</code>: Menguji konektivitas jaringan ke host tertentu menggunakan protokol ICMP dan mengukur latency round-trip.</li>
    <li><code>ip a</code> atau <code>ifconfig</code>: Menampilkan konfigurasi interface jaringan aktif dan alamat IP (IPv4 & IPv6).</li>
    <li><code>curl URL</code> (<em>Client URL</em>): Mentransfer data dari atau ke server web via protokol HTTP/HTTPS. Sangat umum digunakan untuk menguji REST API dan mengunduh file.</li>
</ul>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="ip a"><code>ip a</code> - Lihat interface & alamat IP</button>
    <button class="btn-run-cmd" data-cmd="ping 8.8.8.8"><code>ping 8.8.8.8</code> - Uji koneksi ke DNS Google</button>
    <button class="btn-run-cmd" data-cmd="curl https://api.github.com"><code>curl https://api.github.com</code> - Request ke API</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t6_ip",
                "text": "Periksa konfigurasi alamat IP antarmuka lab Anda menggunakan perintah <code>ip a</code>.",
                "check_type": "command_history",
                "expected": "ip a"
            },
            {
                "id": "t6_ping",
                "text": "Lakukan pengetesan koneksi jaringan menggunakan perintah <code>ping 8.8.8.8</code>.",
                "check_type": "command_history",
                "expected": "ping"
            },
            {
                "id": "t6_neofetch",
                "text": "Jalankan perintah <code>neofetch</code> untuk menampilkan ringkasan visual spesifikasi mesin Linux Anda.",
                "check_type": "last_command",
                "expected": "neofetch"
            }
        ],
        "quiz": [
            {
                "question": "Perintah apt apa yang harus dijalankan sebelum menginstal paket baru untuk memastikan daftar versi software terupdate?",
                "options": ["apt upgrade", "apt update", "apt refresh", "apt get"],
                "answer": 1,
                "explanation": "'apt update' memperbarui cache daftar paket lokal dari repositori jarak jauh."
            },
            {
                "question": "Protokol apa yang digunakan oleh utilitas 'ping' untuk memeriksa keterjangkauan host?",
                "options": ["TCP", "UDP", "ICMP", "HTTP"],
                "answer": 2,
                "explanation": "Ping menggunakan pesan ICMP Echo Request dan Echo Reply."
            },
            {
                "question": "Perintah modern manakah yang menggantikan 'ifconfig' untuk melihat konfigurasi IP jaringan di Linux?",
                "options": ["ip a", "netstat", "route", "traceroute"],
                "answer": 0,
                "explanation": "'ip a' (ip address) dari paket iproute2 adalah standar modern pengganti ifconfig."
            }
        ]
    },
    {
        "id": "modul-7",
        "slug": "dasar-bash-scripting",
        "order": 7,
        "title": "Dasar Pemrograman Bash Scripting",
        "summary": "Otomasi tugas harian dengan skrip Shell: shebang, variabel, input argumen, percabangan if-else, dan looping.",
        "duration": "40 menit",
        "level": "Mahir",
        "icon": "code-slash",
        "sections": [
            {
                "title": "Anatomi Skrip Bash & Shebang",
                "content": """
<p>Bash Script adalah file teks berisi urutan perintah terminal yang dieksekusi secara otomatis oleh interpreter Bash. Setiap skrip diawali dengan baris <strong>Shebang</strong>:</p>
<div class="code-block">
    <pre><code>#!/bin/bash
# Ini adalah komentar
echo "Halo dunia Linux!"</code></pre>
</div>
<p>Langkah menjalankan skrip:</p>
<ol>
    <li>Buat file skrip, misal dengan editor nano: <code>nano halo.sh</code></li>
    <li>Beri izin eksekusi: <code>chmod +x halo.sh</code></li>
    <li>Jalankan skrip: <code>./halo.sh</code></li>
</ol>
"""
            },
            {
                "title": "Variabel & Argumen Input",
                "content": """
<p>Mendefinisikan dan memanggil variabel (perhatikan: <strong>tidak boleh ada spasi</strong> di sekitar tanda sama dengan <code>=</code>):</p>
<div class="code-block">
    <pre><code>NAME="Linux Student"
PORT=8080
echo "Selamat datang, $NAME pada port $PORT"</code></pre>
</div>
<p>Variabel khusus bawaan shell:</p>
<ul>
    <li><code>$0</code>: Nama file skrip yang sedang dijalankan.</li>
    <li><code>$1, $2, ...</code>: Argumen baris perintah pertama, kedua, dst.</li>
    <li><code>$#</code>: Jumlah total argumen yang dikirim.</li>
    <li><code>$?</code>: Status kode keluar (Exit status) dari perintah terakhir (0 = Sukses).</li>
</ul>
"""
            },
            {
                "title": "Percabangan If-Else & Pengulangan For",
                "content": """
<p>Struktur percabangan kondisi di Bash:</p>
<div class="code-block">
    <pre><code>if [ -f "/etc/passwd" ]; then
    echo "File konfigurasi ditemukan!"
else
    echo "File tidak ditemukan!"
fi</code></pre>
</div>
<p>Contoh perulangan sederhana (for loop):</p>
<div class="code-block">
    <pre><code>for i in 1 2 3 4 5; do
    echo "Iterasi ke-$i"
done</code></pre>
</div>
<div class="code-actions">
    <button class="btn-run-cmd" data-cmd="nano halo.sh"><code>nano halo.sh</code> - Buka editor nano di terminal</button>
</div>
"""
            }
        ],
        "lab_tasks": [
            {
                "id": "t7_nano_create",
                "text": "Buat file skrip baru bernama <code>welcome.sh</code> di home direktori.",
                "check_type": "file_exists",
                "path": "/home/student/welcome.sh",
                "is_dir": False
            },
            {
                "id": "t7_shebang",
                "text": "Pastikan file <code>welcome.sh</code> memiliki baris shebang <code>#!/bin/bash</code> di dalamnya.",
                "check_type": "file_content",
                "path": "/home/student/welcome.sh",
                "contains": "#!/bin/bash"
            },
            {
                "id": "t7_exec_perm",
                "text": "Beri hak akses eksekusi pada <code>welcome.sh</code> menggunakan <code>chmod +x welcome.sh</code>.",
                "check_type": "file_permission",
                "path": "/home/student/welcome.sh",
                "has_exec": True
            }
        ],
        "quiz": [
            {
                "question": "Apakah fungsi baris shebang '#!/bin/bash' di baris paling pertama sebuah file skrip?",
                "options": [
                    "Sebagai catatan dokumentasi pengembang",
                    "Menentukan program interpreter yang digunakan untuk mengeksekusi skrip",
                    "Memberikan izin eksekusi otomatis tanpa chmod",
                    "Mengunci skrip dari modifikasi user lain"
                ],
                "answer": 1,
                "explanation": "Shebang memberitahukan sistem operasi program interpreter biner mana (/bin/bash) yang bertugas mengeksekusi file tersebut."
            },
            {
                "question": "Variabel shell bawaan apakah yang menyimpan exit code (status sukses/gagal) dari perintah yang baru saja selesai dijalankan?",
                "options": ["$!", "$$", "$?", "$#"],
                "answer": 2,
                "explanation": "$? menyimpan exit status dari command terakhir (0 berarti berhasil, non-zero berarti error)."
            },
            {
                "question": "Manakah sintaks penulisan assignment variabel yang benar dalam skrip Bash?",
                "options": [
                    "MY_VAR = 100",
                    "MY_VAR=100",
                    "var MY_VAR = 100",
                    "$MY_VAR = 100"
                ],
                "answer": 1,
                "explanation": "Dalam Bash, tidak boleh ada spasi sebelum maupun sesudah tanda sama dengan (MY_VAR=100)."
            }
        ]
    }
]

# Hands-on Challenges / CTF Missions
CHALLENGES = [
    {
        "id": "c1",
        "title": "Misi 1: Rahasia Tersembunyi (Hidden Secret)",
        "category": "Navigasi & File",
        "difficulty": "Mudah",
        "points": 50,
        "description": "Seorang sysadmin menyimpan file kredensial rahasia di folder <code>/var/backup</code>. Carilah file tersembunyi bernama <code>.secret_key</code>, baca isinya, dan temukan kodenya!",
        "hint": "Gunakan perintah <code>cd /var/backup</code> lalu <code>ls -a</code> untuk melihat file tersembunyi, lalu <code>cat</code> untuk membaca isinya.",
        "target_file": "/var/backup/.secret_key",
        "flag": "FLAG{L1NUX_H1DD3N_F1L3_FOUND_992}",
        "initial_setup": {
            "path": "/var/backup/.secret_key",
            "content": "FLAG{L1NUX_H1DD3N_F1L3_FOUND_992}",
            "mode": "644"
        }
    },
    {
        "id": "c2",
        "title": "Misi 2: Penguncian Izin Akses (Permission Lockdown)",
        "category": "Keamanan & Izin",
        "difficulty": "Mudah",
        "points": 50,
        "description": "File skrip produksi <code>/home/student/deploy.sh</code> memiliki izin akses yang terlalu terbuka (777). Amankan file ini agar hanya <strong>Owner (student)</strong> yang bisa membaca, menulis, dan mengeksekusinya (izin 700), sedangkan group dan others tidak punya akses sama sekali.",
        "hint": "Gunakan perintah <code>chmod 700 /home/student/deploy.sh</code>.",
        "target_file": "/home/student/deploy.sh",
        "expected_mode": "700",
        "initial_setup": {
            "path": "/home/student/deploy.sh",
            "content": "#!/bin/bash\necho 'Deploying production application...'\nexit 0\n",
            "mode": "777"
        }
    },
    {
        "id": "c3",
        "title": "Misi 3: Perburuan Log Sistem (Syslog Hunter)",
        "category": "Pencarian Teks & Pipe",
        "difficulty": "Sedang",
        "points": 100,
        "description": "Server mengalami kegagalan. Filter semua baris yang mengandung teks 'CRITICAL' pada file <code>/var/log/syslog</code> dan simpan seluruh hasilnya ke file baru di <code>/home/student/critical_errors.txt</code>.",
        "hint": "Gunakan pipeline / redirection: <code>grep 'CRITICAL' /var/log/syslog > /home/student/critical_errors.txt</code>.",
        "target_file": "/home/student/critical_errors.txt",
        "check_contains": "CRITICAL",
        "initial_setup": None
    },
    {
        "id": "c4",
        "title": "Misi 4: Eliminasi Proses Liar (Rogue Process Killer)",
        "category": "Manajemen Proses",
        "difficulty": "Sedang",
        "points": 100,
        "description": "Terdapat proses penambang mencurigakan bernama <code>crypto_miner</code> yang menghabiskan daya CPU. Temukan PID-nya menggunakan <code>ps aux</code> lalu hentikan proses tersebut menggunakan perintah <code>kill</code>!",
        "hint": "Jalankan <code>ps aux</code>, cari baris <code>crypto_miner</code>, catat nomor PID-nya, lalu ketik <code>kill <PID></code>.",
        "target_process": "crypto_miner"
    },
    {
        "id": "c5",
        "title": "Misi 5: Blueprint Struktur Proyek (Directory Blueprint)",
        "category": "Navigasi & File",
        "difficulty": "Sedang",
        "points": 100,
        "description": "Buat direktori proyek lengkap dengan struktur: <code>/home/student/app</code> yang di dalamnya memiliki subdirektori <code>src</code>, <code>logs</code>, dan <code>config</code>, serta sebuah file <code>config/app.conf</code>.",
        "hint": "Gunakan <code>mkdir -p /home/student/app/src /home/student/app/logs /home/student/app/config</code> lalu <code>touch /home/student/app/config/app.conf</code>.",
        "target_file": "/home/student/app/config/app.conf"
    },
    {
        "id": "c6",
        "title": "Misi 6: Audit Keamanan Pengguna (/etc/passwd Audit)",
        "category": "Text Processing",
        "difficulty": "Mahir",
        "points": 150,
        "description": "Hitung berapa banyak akun user di file <code>/etc/passwd</code> yang menggunakan shell login <code>/bin/bash</code>. Simpan hanya angka jumlahnya saja ke dalam file <code>/home/student/bash_users_count.txt</code>.",
        "hint": "Gunakan grep dan wc: <code>grep '/bin/bash' /etc/passwd | wc -l > /home/student/bash_users_count.txt</code>.",
        "target_file": "/home/student/bash_users_count.txt"
    },
    {
        "id": "c7",
        "title": "Misi 7: Skrip Otomasi Backup (Backup Automation)",
        "category": "Bash Scripting",
        "difficulty": "Mahir",
        "points": 150,
        "description": "Gunakan editor nano untuk membuat skrip <code>/home/student/backup.sh</code> yang memiliki shebang <code>#!/bin/bash</code>, menyalin file apa pun, dan memiliki izin eksekusi (755).",
        "hint": "Buka nano dengan <code>nano /home/student/backup.sh</code>, tulis isi skrip, simpan (Ctrl+O lalu Ctrl+X), lalu jalankan <code>chmod +x /home/student/backup.sh</code>.",
        "target_file": "/home/student/backup.sh"
    }
]

# Command Cheatsheet Reference
CHEATSHEET = [
    {
        "category": "Navigasi & Hirarki",
        "commands": [
            {"cmd": "pwd", "syntax": "pwd", "desc": "Menampilkan direktori kerja saat ini (Print Working Directory)."},
            {"cmd": "ls", "syntax": "ls [opsi] [path]", "desc": "Melihat daftar file dan direktori. Opsi umum: -l (detail), -a (semua), -h (human-readable)."},
            {"cmd": "cd", "syntax": "cd [direktori]", "desc": "Berpindah direktori aktif. Gunakan '..' untuk naik, '~' untuk home, '-' untuk lokasi sebelumnya."},
            {"cmd": "tree", "syntax": "tree [direktori]", "desc": "Menampilkan pohon hirarki direktori secara visual grafis."}
        ]
    },
    {
        "category": "Operasi File & Direktori",
        "commands": [
            {"cmd": "touch", "syntax": "touch file.txt", "desc": "Membuat file kosong baru atau memperbarui timestamp."},
            {"cmd": "mkdir", "syntax": "mkdir [-p] folder", "desc": "Membuat folder baru. Flag -p untuk membuat folder bersarang (parent & child)."},
            {"cmd": "cp", "syntax": "cp [-r] sumber tujuan", "desc": "Menyalin file atau folder (-r rekursif untuk folder)."},
            {"cmd": "mv", "syntax": "mv sumber tujuan", "desc": "Memindahkan file atau mengubah nama file (rename)."},
            {"cmd": "rm", "syntax": "rm [-rf] file/folder", "desc": "Menghapus file secara permanen (-r untuk folder, -f paksa)."},
            {"cmd": "nano", "syntax": "nano [file]", "desc": "Editor teks terminal interaktif yang ramah pengguna."}
        ]
    },
    {
        "category": "Membaca & Memproses Teks",
        "commands": [
            {"cmd": "cat", "syntax": "cat file", "desc": "Menampilkan seluruh isi file ke terminal."},
            {"cmd": "head", "syntax": "head [-n N] file", "desc": "Menampilkan N baris pertama dari suatu file (default 10)."},
            {"cmd": "tail", "syntax": "tail [-n N] file", "desc": "Menampilkan N baris terakhir dari suatu file."},
            {"cmd": "grep", "syntax": "grep [opsi] 'pola' file", "desc": "Mencari baris teks yang cocok dengan pola/regex (-i case insensitive, -v invert)."},
            {"cmd": "wc", "syntax": "wc [-l|-w|-c] file", "desc": "Menghitung jumlah baris (-l), kata (-w), atau karakter (-c)."},
            {"cmd": "sort", "syntax": "sort [-r|-n] file", "desc": "Mengurutkan baris teks (-r reverse, -n numerik)."},
            {"cmd": "find", "syntax": "find path -name 'pola'", "desc": "Mencari file dan folder dalam pohon direktori."}
        ]
    },
    {
        "category": "Izin & Kepemilikan",
        "commands": [
            {"cmd": "chmod", "syntax": "chmod [mode] file", "desc": "Mengubah izin akses file/folder (contoh: 755, 644, 600, +x)."},
            {"cmd": "chown", "syntax": "chown user[:group] file", "desc": "Mengubah pemilik (owner) dan grup pemilik file."},
            {"cmd": "whoami", "syntax": "whoami", "desc": "Menampilkan nama user yang sedang login aktif."},
            {"cmd": "id", "syntax": "id [user]", "desc": "Menampilkan UID, GID, dan grup yang diikuti user."},
            {"cmd": "sudo", "syntax": "sudo command", "desc": "Menjalankan perintah dengan hak istimewa administrator (root)."}
        ]
    },
    {
        "category": "Manajemen Proses & Sistem",
        "commands": [
            {"cmd": "ps", "syntax": "ps aux", "desc": "Melihat daftar status seluruh proses yang sedang aktif."},
            {"cmd": "top", "syntax": "top", "desc": "Task manager interaktif real-time CPU & Memori."},
            {"cmd": "kill", "syntax": "kill [-9] PID", "desc": "Mengirim sinyal penghentian ke proses berdasarkan PID (-9 paksa)."},
            {"cmd": "df", "syntax": "df -h", "desc": "Melihat statistik pemakaian media penyimpanan (Disk Free)."},
            {"cmd": "free", "syntax": "free -m", "desc": "Melihat kapasitas dan sisa memori RAM (dalam MB)."},
            {"cmd": "uptime", "syntax": "uptime", "desc": "Melihat berapa lama komputer telah menyala dan load average."},
            {"cmd": "uname", "syntax": "uname -a", "desc": "Melihat informasi kernel dan arsitektur mesin Linux."}
        ]
    },
    {
        "category": "Jaringan & Paket",
        "commands": [
            {"cmd": "ip a", "syntax": "ip a", "desc": "Melihat interface jaringan dan alamat IP aktif."},
            {"cmd": "ping", "syntax": "ping [-c N] host", "desc": "Menguji konektivitas jaringan ICMP ke suatu alamat IP/domain."},
            {"cmd": "curl", "syntax": "curl [opsi] URL", "desc": "Mengunduh atau mentransfer data dari/ke URL web."},
            {"cmd": "apt", "syntax": "apt [update|install|remove] pkg", "desc": "Manajer paket software pada Debian/Ubuntu."},
            {"cmd": "neofetch", "syntax": "neofetch", "desc": "Menampilkan logo distro ASCII art dan spesifikasi hardware/OS."}
        ]
    }
]

# Lab Scenarios for Standalone Lab
LAB_SCENARIOS = [
    {
        "id": "sandbox",
        "name": "Default Sandbox (Bebas)",
        "badge": "Standar",
        "desc": "Lingkungan virtual Linux standar dengan direktori pengguna, struktur FHS lengkap, dan file sistem umum.",
        "icon": "terminal"
    },
    {
        "id": "syslog_investigation",
        "name": "Investigasi Log Server Web",
        "badge": "Praktik Kasus",
        "desc": "Skenario server crash: Terdapat log Apache di <code>/var/log/nginx/access.log</code> yang penuh dengan percobaan serangan SQLi dan 500 error untuk dianalisis.",
        "icon": "shield-exclamation"
    },
    {
        "id": "permission_audit",
        "name": "Audit Hardening Keamanan Izin",
        "badge": "Keamanan",
        "desc": "Beberapa file rahasia di direktori proyek memiliki izin akses 777 yang sangat berbahaya. Tugas Anda melakukan audit dan mitigasi.",
        "icon": "lock"
    },
    {
        "id": "scripting_playground",
        "name": "Playground Bash Scripting",
        "badge": "Coding",
        "desc": "Lingkungan dengan beberapa contoh skrip siap pakai (.sh) dan data CSV untuk latihan piping, awk, dan looping.",
        "icon": "code-slash"
    }
]

# Routes
@app.route('/')
def index():
    return render_template('index.html', modules=MODULES, challenges=CHALLENGES)

@app.route('/learn')
def learn():
    module_id = request.args.get('module', 'modul-1')
    current_module = next((m for m in MODULES if m['id'] == module_id), MODULES[0])
    return render_template('learn.html', modules=MODULES, current_module=current_module)

@app.route('/lab')
def lab():
    scenario = request.args.get('scenario', 'sandbox')
    return render_template('lab.html', scenarios=LAB_SCENARIOS, current_scenario=scenario)

@app.route('/challenges')
def challenges():
    return render_template('challenges.html', challenges=CHALLENGES)

@app.route('/cheatsheet')
def cheatsheet():
    return render_template('cheatsheet.html', cheatsheet=CHEATSHEET)

@app.route('/certificate')
def certificate():
    return render_template('certificate.html', modules=MODULES)

# Authentication & Account Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        user = db.get_user_by_id(session['user_id'])
        if user and user.get('role') == 'guru':
            return redirect(url_for('teacher_dashboard'))
        return redirect(url_for('learn'))

    next_page = request.args.get('next') or request.form.get('next') or ''

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Harap isi username/email dan password.', 'danger')
            return render_template('login.html', next=next_page)

        user = db.authenticate_user(username, password)
        if not user:
            flash('Username/email atau kata sandi tidak cocok. Silakan periksa kembali.', 'danger')
            return render_template('login.html', next=next_page)

        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session.permanent = True

        role_label = 'Instruktur/Guru' if user['role'] == 'guru' else 'Siswa'
        flash(f"Selamat datang, {user['fullname']}! ({role_label})", 'success')

        if user['role'] == 'guru':
            return redirect(url_for('teacher_dashboard'))

        if next_page and next_page.startswith('/'):
            return redirect(next_page)
        return redirect(url_for('learn'))

    return render_template('login.html', next=next_page)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        fullname = request.form.get('fullname', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        role = request.form.get('role', 'siswa').strip().lower()
        teacher_code = request.form.get('teacher_code', '').strip()

        if not username or not fullname or not password:
            flash('Harap lengkapi semua bidang yang bertanda wajib.', 'danger')
            return render_template('register.html')

        if len(password) < 4:
            flash('Kata sandi minimal 4 karakter.', 'danger')
            return render_template('register.html')

        if password != confirm_password:
            flash('Konfirmasi kata sandi tidak cocok.', 'danger')
            return render_template('register.html')

        if role == 'guru':
            if teacher_code != 'GURU2026':
                flash('Kode Verifikasi Guru tidak valid (gunakan kode: GURU2026).', 'danger')
                return render_template('register.html')
        else:
            role = 'siswa'

        result = db.create_user(username, fullname, email, password, role=role)
        if not result['success']:
            flash(result['error'], 'danger')
            return render_template('register.html')

        user = db.get_user_by_id(result['user_id'])
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session.permanent = True

        flash(f"Akun berhasil didaftarkan! Selamat datang di LinuxAcademy, {user['fullname']}.", 'success')

        if user['role'] == 'guru':
            return redirect(url_for('teacher_dashboard'))
        return redirect(url_for('learn'))

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Anda telah berhasil keluar (logout).', 'info')
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    user = db.get_user_by_id(session['user_id'])
    progress = db.get_student_progress(session['user_id']) if user['role'] == 'siswa' else None
    return render_template('profile.html', user=user, progress=progress, modules=MODULES, challenges=CHALLENGES)

# Teacher / Instructor Dashboard
@app.route('/teacher/dashboard')
@teacher_required
def teacher_dashboard():
    students = db.get_all_students_overview()
    total_students = len(students)
    certified_count = sum(1 for s in students if s['certified'])
    avg_class_points = round(sum(s['total_points'] for s in students) / total_students) if total_students else 0
    return render_template('teacher_dashboard.html', 
                           students=students, 
                           total_students=total_students, 
                           certified_count=certified_count, 
                           avg_class_points=avg_class_points,
                           modules=MODULES, 
                           challenges=CHALLENGES)

# API Endpoints
@app.route('/api/current-user')
def api_current_user():
    user_id = session.get('user_id')
    if user_id:
        user = db.get_user_by_id(user_id)
        if user:
            return jsonify({
                'logged_in': True,
                'user': user
            })
    return jsonify({'logged_in': False, 'user': None})

@app.route('/api/progress')
@login_required
def api_get_progress():
    progress = db.get_student_progress(session['user_id'])
    return jsonify(progress)

@app.route('/api/progress/sync', methods=['POST'])
@login_required
def api_sync_progress():
    if session.get('role') != 'siswa':
        return jsonify({'success': False, 'message': 'Hanya akun siswa yang mencatat progres.'}), 403

    data = request.get_json() or {}
    completed_modules = data.get('completedModules', [])
    completed_tasks = data.get('completedTasks', [])
    solved_challenges = data.get('solvedChallenges', [])
    quiz_scores = data.get('quizScores', {})
    total_points = int(data.get('totalPoints', 0))

    db.update_student_progress(
        session['user_id'],
        completed_modules,
        completed_tasks,
        solved_challenges,
        quiz_scores,
        total_points
    )
    return jsonify({'success': True, 'message': 'Progres berhasil disinkronisasi ke server!'})

@app.route('/api/modules')
def api_modules():
    return jsonify(MODULES)

@app.route('/api/challenges')
def api_challenges():
    return jsonify(CHALLENGES)

@app.route('/api/cheatsheet')
def api_cheatsheet():
    return jsonify(CHEATSHEET)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 LMS Linux & Virtual Lab berjalan di: http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)

