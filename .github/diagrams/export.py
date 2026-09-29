from playwright.sync_api import sync_playwright
import sys, pathlib
with sync_playwright() as p:
    b = p.chromium.launch()
    for src in sys.argv[1:]:
        pg = b.new_page(device_scale_factor=2)
        pg.goto(f"file://{pathlib.Path(src).resolve()}")
        pg.wait_for_load_state("networkidle")
        out = src.replace(".html", ".png")
        pg.locator("svg").first.screenshot(path=out, omit_background=True)
        print(out)
    b.close()
