"""
Database helper module for Linux LMS.
Uses Python's built-in sqlite3 with connection management and helper functions.
"""

import sqlite3
import os
import json
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initializes tables and seeds default guru and siswa accounts if not existing."""
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            fullname TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'siswa', -- 'siswa' or 'guru'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Student progress table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS student_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            completed_modules TEXT DEFAULT '[]', -- JSON list of module IDs
            completed_tasks TEXT DEFAULT '[]',   -- JSON list of task IDs
            solved_challenges TEXT DEFAULT '[]', -- JSON list of challenge IDs
            quiz_scores TEXT DEFAULT '{}',       -- JSON dict {module_id: score}
            total_points INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Seed default accounts if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        # Default Guru (Teacher)
        guru_pw = generate_password_hash('guru123')
        cursor.execute("""
            INSERT INTO users (username, fullname, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        """, ('guru', 'Bpk. Ahmad Fauzi (Instruktur)', 'guru@linuxacademy.id', guru_pw, 'guru'))

        # Default Siswa (Student)
        siswa_pw = generate_password_hash('siswa123')
        cursor.execute("""
            INSERT INTO users (username, fullname, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        """, ('siswa', 'Rizky Pratama', 'siswa@linuxacademy.id', siswa_pw, 'siswa'))
        siswa_id = cursor.lastrowid

        # Seed sample progress for siswa demo
        sample_modules = json.dumps(['modul-1', 'modul-2'])
        sample_tasks = json.dumps(['t1_pwd', 't1_whoami', 't1_explore_root', 't2_ls', 't2_mkdir'])
        sample_challenges = json.dumps(['c1'])
        sample_quizzes = json.dumps({'modul-1': 100, 'modul-2': 85})
        sample_points = 290

        cursor.execute("""
            INSERT INTO student_progress 
            (user_id, completed_modules, completed_tasks, solved_challenges, quiz_scores, total_points)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (siswa_id, sample_modules, sample_tasks, sample_challenges, sample_quizzes, sample_points))

    conn.commit()
    conn.close()

def create_user(username, fullname, email, password, role='siswa'):
    conn = get_db()
    cursor = conn.cursor()
    pw_hash = generate_password_hash(password)
    try:
        cursor.execute("""
            INSERT INTO users (username, fullname, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        """, (username.strip().lower(), fullname.strip(), email.strip().lower() if email else None, pw_hash, role))
        user_id = cursor.lastrowid

        # Create initial empty progress record if role is siswa
        if role == 'siswa':
            cursor.execute("""
                INSERT INTO student_progress (user_id) VALUES (?)
            """, (user_id,))

        conn.commit()
        return {'success': True, 'user_id': user_id}
    except sqlite3.IntegrityError as e:
        err_msg = str(e).lower()
        if 'users.username' in err_msg or 'unique constraint failed: users.username' in err_msg:
            return {'success': False, 'error': 'Username sudah terdaftar!'}
        elif 'users.email' in err_msg or 'unique constraint failed: users.email' in err_msg:
            return {'success': False, 'error': 'Email sudah terdaftar!'}
        return {'success': False, 'error': 'Terjadi kesalahan registrasi.'}
    finally:
        conn.close()

def authenticate_user(username_or_email, password):
    conn = get_db()
    cursor = conn.cursor()
    val = username_or_email.strip().lower()
    cursor.execute("""
        SELECT * FROM users WHERE username = ? OR email = ?
    """, (val, val))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        return dict(user)
    return None

def get_user_by_id(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, fullname, email, role, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def get_student_progress(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM student_progress WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            'completed_modules': [],
            'completed_tasks': [],
            'solved_challenges': [],
            'quiz_scores': {},
            'total_points': 0
        }

    return {
        'completed_modules': json.loads(row['completed_modules'] or '[]'),
        'completed_tasks': json.loads(row['completed_tasks'] or '[]'),
        'solved_challenges': json.loads(row['solved_challenges'] or '[]'),
        'quiz_scores': json.loads(row['quiz_scores'] or '{}'),
        'total_points': row['total_points'] or 0,
        'updated_at': row['updated_at']
    }

def update_student_progress(user_id, completed_modules, completed_tasks, solved_challenges, quiz_scores, total_points):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO student_progress (user_id, completed_modules, completed_tasks, solved_challenges, quiz_scores, total_points, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            completed_modules = excluded.completed_modules,
            completed_tasks = excluded.completed_tasks,
            solved_challenges = excluded.solved_challenges,
            quiz_scores = excluded.quiz_scores,
            total_points = excluded.total_points,
            updated_at = CURRENT_TIMESTAMP
    """, (
        user_id,
        json.dumps(completed_modules),
        json.dumps(completed_tasks),
        json.dumps(solved_challenges),
        json.dumps(quiz_scores),
        total_points
    ))
    conn.commit()
    conn.close()
    return True

def get_all_students_overview():
    """Returns overview of all students for Teacher Dashboard."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            u.id,
            u.username,
            u.fullname,
            u.email,
            u.created_at,
            COALESCE(p.completed_modules, '[]') as completed_modules,
            COALESCE(p.completed_tasks, '[]') as completed_tasks,
            COALESCE(p.solved_challenges, '[]') as solved_challenges,
            COALESCE(p.quiz_scores, '{}') as quiz_scores,
            COALESCE(p.total_points, 0) as total_points,
            p.updated_at as last_activity
        FROM users u
        LEFT JOIN student_progress p ON u.id = p.user_id
        WHERE u.role = 'siswa'
        ORDER BY total_points DESC, u.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    students = []
    for r in rows:
        c_mods = json.loads(r['completed_modules'])
        c_tasks = json.loads(r['completed_tasks'])
        s_challenges = json.loads(r['solved_challenges'])
        q_scores = json.loads(r['quiz_scores'])

        # Calculate average quiz score
        scores = list(q_scores.values())
        avg_score = round(sum(scores) / len(scores)) if scores else 0

        students.append({
            'id': r['id'],
            'username': r['username'],
            'fullname': r['fullname'],
            'email': r['email'],
            'created_at': r['created_at'],
            'last_activity': r['last_activity'],
            'completed_modules_count': len(c_mods),
            'completed_modules': c_mods,
            'completed_tasks_count': len(c_tasks),
            'solved_challenges_count': len(s_challenges),
            'quiz_scores': q_scores,
            'avg_score': avg_score,
            'total_points': r['total_points'],
            'certified': len(c_mods) >= 7 and avg_score >= 70
        })

    return students
