"""
Launcher script for LMS Linux & Virtual Lab.
Run this script to start the server and open in browser:
    python run.py
"""

import os
import sys
import webbrowser
import threading
import time

def start_server():
    from app import app
    port = int(os.environ.get('PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=False)

def open_browser():
    time.sleep(1.2)
    url = "http://127.0.0.1:5000"
    print(f"\n========================================================")
    print(f"🐧 LMS Linux dengan Virtual Lab siap digunakan!")
    print(f"🌐 Buka di browser: {url}")
    print(f"========================================================\n")
    try:
        webbrowser.open(url)
    except Exception:
        pass

if __name__ == '__main__':
    t = threading.Thread(target=open_browser)
    t.daemon = True
    t.start()
    start_server()
