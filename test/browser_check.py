from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8787"
SHOTS = Path(r"C:\Users\mpatil039\AppData\Local\Temp\sip-survey")
CODE = Path(r"c:\Salesforce Projects\Survey\data\organizer-code.txt").read_text(encoding="utf-8").strip()


def shot(page, name):
    page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def next_q(page):
    page.get_by_role("button", name="Next").click()


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(BASE, wait_until="load")
        page.get_by_role("heading", name="Tell us what you’d actually drink.")
        intro = page.locator("main").inner_text()
        assert "₹60" not in intro
        assert "not interested" in intro
        shot(page, "01-intro-desktop")

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto(BASE, wait_until="load")
        mobile.screenshot(path=str(SHOTS / "02-intro-mobile.png"), full_page=True)
        mobile.close()

        page.get_by_role("button", name="Start the survey").click()
        page.get_by_role("heading", name="What is your age group?")
        page.get_by_role("radio", name="Under 18").click()
        page.get_by_role("button", name="End survey").click()
        page.get_by_text("This survey is only for people aged 18 and over.")
        shot(page, "03-under-18")

        page.goto(BASE, wait_until="load")
        page.get_by_role("button", name="Start the survey").click()
        page.get_by_role("radio", name="25–34").click()
        next_q(page)
        page.get_by_role("button", name="Skip this question").click()
        page.get_by_placeholder("Andheri, Mumbai").fill("Andheri, Mumbai")
        next_q(page)
        page.get_by_role("button", name="Skip this question").click()
        page.get_by_role("radio", name="No", exact=True).click()
        next_q(page)
        page.get_by_role("heading", name="Have you tried saffron—or kesar—in food or drinks?")
        shot(page, "04-skipped-habits")

        page.goto(BASE, wait_until="load")
        page.get_by_role("button", name="Start the survey").click()
        page.get_by_role("radio", name="25–34").click()
        next_q(page)
        page.get_by_placeholder("Name or email ID").fill("Asha")
        next_q(page)
        page.get_by_placeholder("Andheri, Mumbai").fill("Andheri, Mumbai")
        next_q(page)
        page.get_by_role("radio", name="₹60,000–99,999").click()
        next_q(page)
        page.get_by_role("radio", name="Yes", exact=True).click()
        next_q(page)
        page.get_by_role("heading", name="How often do you usually buy packaged cold beverages?")
        page.get_by_role("radio", name="About once a week").click()
        next_q(page)
        for drink in ["Iced tea", "Juice or fruit drinks", "Coconut water", "Kombucha"]:
            page.get_by_role("checkbox", name=drink).click()
        page.get_by_text("You can choose up to 3.")
        page.get_by_role("checkbox", name="Kombucha").click()
        next_q(page)
        page.get_by_role("checkbox", name="Quick-commerce app").click()
        page.get_by_role("checkbox", name="Supermarket").click()
        next_q(page)
        page.get_by_role("checkbox", name="Taste", exact=True).click()
        page.get_by_role("checkbox", name="Low sugar").click()
        next_q(page)
        page.get_by_role("radio", name="₹50–69").click()
        next_q(page)
        page.get_by_role("radio", name="Mildly sweet").click()
        next_q(page)
        page.get_by_role("radio", name="Yes, occasionally").click()
        next_q(page)
        concept = page.locator("main").inner_text()
        assert "water-based, not milk-based, lightly carbonated" in concept
        assert "immunity" not in concept.lower()
        page.get_by_role("radio", name="4").click()
        shot(page, "05-appeal")
        next_q(page)
        page.get_by_role("checkbox", name="After exercise").click()
        page.get_by_role("checkbox", name="An occasional treat").click()
        next_q(page)
        page.get_by_role("radio", name="Saffron + cardamom").click()
        next_q(page)
        page.get_by_role("radio", name="250 ml").click()
        next_q(page)
        page.get_by_role("checkbox", name="No particular concern").click()
        page.get_by_role("checkbox", name="Price", exact=True).click()
        assert page.get_by_role("checkbox", name="No particular concern").get_attribute("aria-checked") == "false"
        next_q(page)
        page.get_by_text("consider the original 250 ml")
        page.get_by_role("button", name="Skip this question").click()
        page.get_by_role("radio", name="₹60–79").click()
        next_q(page)
        price = page.locator("main").inner_text()
        assert "₹60 per 250 ml bottle, including taxes" in price
        shot(page, "06-price")
        page.get_by_role("radio", name="4 — Probably would buy").click()
        next_q(page)
        page.get_by_role("radio", name="2", exact=True).click()
        next_q(page)
        page.get_by_role("radio", name="3–5").click()
        next_q(page)
        page.get_by_role("radio", name="Single bottle").click()
        next_q(page)
        page.get_by_role("button", name="Skip this question").click()
        page.get_by_role("radio", name="Yes—both").click()
        page.get_by_label("Name").fill("Asha")
        page.get_by_label("Phone number or email address").fill("asha@example.com")
        page.get_by_role("button", name="Send my answers").click()
        page.get_by_text("Thank you for sharing your feedback.")
        shot(page, "07-thanks")

        dash = browser.new_page(viewport={"width": 1280, "height": 900})
        dash.goto(BASE + "/dashboard", wait_until="load")
        dash.get_by_label("Organiser code").fill(CODE)
        dash.get_by_role("button", name="Open responses").click()
        dash.get_by_text("What people said about the saffron drink.")
        dash.get_by_text("Asha")
        shot(dash, "08-dashboard")
        dash.set_viewport_size({"width": 390, "height": 844})
        dash.screenshot(path=str(SHOTS / "09-dashboard-mobile.png"), full_page=True)

        assert not errors, errors
        browser.close()
        print("browser check passed")


if __name__ == "__main__":
    main()
