# jules-scratch/verification/verify_ui_changes.py
import os
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    Navigates through the application's main pages (Login, Chat, Profile)
    and takes screenshots to verify UI/UX improvements.
    """
    # Get the absolute path to the repository root
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

    # 1. Verify Login Page (`index.html`)
    login_page_path = f'file://{os.path.join(repo_root, "index.html")}'
    page.goto(login_page_path)
    expect(page).to_have_title("ログイン - ChatGo")
    page.screenshot(path="jules-scratch/verification/01_login_page.png")

    # 2. Verify Chat Page (`chat.html`)
    chat_page_path = f'file://{os.path.join(repo_root, "chat.html")}'
    page.goto(chat_page_path)
    expect(page).to_have_title("ChatGo - チャット")
    page.screenshot(path="jules-scratch/verification/02_chat_page.png")

    # 3. Verify Profile Page (`profile.html`)
    profile_page_path = f'file://{os.path.join(repo_root, "profile.html")}'
    page.goto(profile_page_path)
    expect(page).to_have_title("ChatGo - プロフィール")
    page.screenshot(path="jules-scratch/verification/03_profile_page.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    run_verification(page)
    browser.close()

print("Verification screenshots captured successfully.")
