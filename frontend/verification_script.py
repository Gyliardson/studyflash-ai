from playwright.sync_api import sync_playwright

def verify_responsive_and_dark_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Desktop Light Mode
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        try:
            page.goto("http://localhost:3000")
            page.wait_for_timeout(3000) # Wait for hydration
            page.screenshot(path="/home/jules/verification/desktop_light.png")
            print("Desktop Light Mode screenshot taken.")
        except Exception as e:
            print(f"Error desktop light: {e}")

        # 2. Mobile Light Mode
        page_mobile = browser.new_page(viewport={"width": 375, "height": 667})
        try:
            page_mobile.goto("http://localhost:3000")
            page_mobile.wait_for_timeout(3000)

            # Check hamburger menu presence
            hamburger = page_mobile.locator("button svg.lucide-menu").first
            if hamburger.is_visible():
                print("Hamburger menu visible on mobile.")
                hamburger.click()
                page_mobile.wait_for_timeout(500)
                page_mobile.screenshot(path="/home/jules/verification/mobile_menu_light.png")
                print("Mobile Menu Light Mode screenshot taken.")
            else:
                print("Hamburger menu NOT visible.")

            # Close menu
            page_mobile.locator("button svg.lucide-x").click()
            page_mobile.wait_for_timeout(500)
            page_mobile.screenshot(path="/home/jules/verification/mobile_home_light.png")
            print("Mobile Home Light Mode screenshot taken.")

        except Exception as e:
            print(f"Error mobile light: {e}")

        # 3. Desktop Dark Mode
        page_dark = browser.new_page(viewport={"width": 1280, "height": 720}, color_scheme="dark")
        try:
            page_dark.goto("http://localhost:3000")
            page_dark.wait_for_timeout(3000)

            # Toggle dark mode manually if system pref isn't enough (since we have a toggle button)
            # Find the toggle button (sun/moon)
            toggle_btn = page_dark.locator("button[aria-label='Alternar tema']")
            if toggle_btn.is_visible():
                toggle_btn.click() # Assuming default is system or light, and click toggles.
                # But we started with color_scheme="dark" in browser context, let's see if next-themes picked it up.
                # If next-themes is set to 'system', it should be dark.

            page_dark.wait_for_timeout(1000)
            page_dark.screenshot(path="/home/jules/verification/desktop_dark.png")
            print("Desktop Dark Mode screenshot taken.")

        except Exception as e:
            print(f"Error desktop dark: {e}")

        browser.close()

if __name__ == "__main__":
    verify_responsive_and_dark_mode()
