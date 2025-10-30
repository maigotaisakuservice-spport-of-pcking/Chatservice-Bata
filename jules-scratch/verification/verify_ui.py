from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the HTML files
        base_path = os.path.abspath(os.path.dirname(__file__))

        # 1. Capture Login Page
        login_page_path = "file://" + os.path.join(base_path, '..', '..', 'index.html')
        page.goto(login_page_path)
        page.screenshot(path="jules-scratch/verification/01_login_page_fixed.png")

        # 2. Capture Chat Page
        chat_page_path = "file://" + os.path.join(base_path, '..', '..', 'chat.html')
        page.goto(chat_page_path)
        page.screenshot(path="jules-scratch/verification/02_chat_page_fixed.png")

        # 3. Capture Profile Page
        profile_page_path = "file://" + os.path.join(base_path, '..', '..', 'profile.html')
        page.goto(profile_page_path)
        page.screenshot(path="jules-scratch/verification/03_profile_page_fixed.png")

        # 4. Capture Register Page
        register_page_path = "file://" + os.path.join(base_path, '..', '..', 'register.html')
        page.goto(register_page_path)
        page.screenshot(path="jules-scratch/verification/04_register_page_fixed.png")

        browser.close()

if __name__ == "__main__":
    run()
