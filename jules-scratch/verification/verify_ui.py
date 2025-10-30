import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get absolute paths to the HTML files
        base_path = os.path.abspath(os.getcwd())
        login_page_url = f"file://{os.path.join(base_path, 'index.html')}"
        register_page_url = f"file://{os.path.join(base_path, 'register.html')}"
        chat_page_url = f"file://{os.path.join(base_path, 'chat.html')}"

        # 1. Verify Login Page UI
        print("Navigating to Login Page...")
        await page.goto(login_page_url)
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path="jules-scratch/verification/1_login_page.png")
        print("Screenshot of Login Page saved.")

        # 2. Verify Registration Flow UI
        print("Navigating to Register Page...")
        await page.goto(register_page_url)
        await page.wait_for_load_state('networkidle')
        await page.screenshot(path="jules-scratch/verification/2_register_page_step1.png")
        print("Screenshot of Register Page (Step 1) saved.")

        # Simulate moving to the next step in registration
        await page.get_by_role("button", name="次へ").click()
        await page.screenshot(path="jules-scratch/verification/3_register_page_step2.png")
        print("Screenshot of Register Page (Step 2 - Phone) saved.")

        # 3. Verify Chat Page UI
        print("Navigating to Chat Page...")
        await page.goto(chat_page_url)
        await page.wait_for_timeout(500) # Wait for potential redirect logic
        await page.screenshot(path="jules-scratch/verification/4_chat_page.png")
        print("Screenshot of Chat Page saved.")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
