# Rebuilds the legal text on a website page from the same file the app uses, so app and web match.
# Usage (website repo next to this one):
#   python3 scripts/build-web-legal.py lib/terms.json   ../przybyszandy-lang.github.io/terms.html
#   python3 scripts/build-web-legal.py lib/terms.json   ../przybyszandy-lang.github.io/conditions.html
#   python3 scripts/build-web-legal.py lib/privacy.json ../przybyszandy-lang.github.io/privacy.html
import html, json, os, re, sys

json_path = sys.argv[1]
data = json.load(open(json_path, encoding="utf-8"))
page_path = sys.argv[2]
source = os.path.basename(json_path)
page = open(page_path, encoding="utf-8").read()

def e(text):
    t = html.escape(text, quote=False)
    t = t.replace("Contact Us page", '<a href="contact.html">Contact Us</a> page')
    t = t.replace("Community Guidelines", '<a href="guidelines.html">Community Guidelines</a>')
    if "privacy" not in source:
        t = t.replace("Privacy Policy", '<a href="privacy.html">Privacy Policy</a>')
    t = t.replace("ico.org.uk", '<a href="https://ico.org.uk" rel="noopener">ico.org.uk</a>')
    t = t.replace("the Terms", 'the <a href="conditions.html">Terms</a>') if "privacy" in source else t
    return t

hero_right = ['          <div class="hero-right">', "            <h2>Before you use the platform</h2>"]
for p in data["intro"]:
    hero_right.append(f"            <p>{e(p)}</p>")
hero_right.append(f'            <p><b>Last updated:</b> {html.escape(data["updated"])}</p>')
hero_right.append("          </div>")

sections = []
for s in data["sections"]:
    parts = ['    <section class="section">', '      <div class="section-card">', f"        <h3>{html.escape(s['title'])}</h3>"]
    for p in s["paragraphs"]:
        parts.append(f"        <p>{e(p)}</p>")
    if s.get("list"):
        parts.append('        <ul style="line-height:1.6; padding-left:22px; margin:0 0 12px;">')
        for item in s["list"]:
            parts.append(f"          <li>{e(item)}</li>")
        parts.append("        </ul>")
    for p in s.get("after", []):
        parts.append(f"        <p>{e(p)}</p>")
    parts += ["      </div>", "    </section>"]
    sections.append("\n".join(parts))

page = re.sub(r'          <div class="hero-right">.*?\n          </div>\n(?=        </div>\n      </div>\n    </section>)',
              "\n".join(hero_right) + "\n", page, count=1, flags=re.S)
start = page.index("    </section>", page.index('<section class="hero">')) + len("    </section>")
end = page.index("  </main>")
page = page[:start] + f"\n\n<!-- TERMS START (generated from donkeyapp-native lib/{source}) -->\n" + "\n\n".join(sections) + "\n<!-- TERMS END -->\n" + page[end:]
open(page_path, "w", encoding="utf-8").write(page)
print(os.path.basename(page_path), "updated from", source + ":", len(data["sections"]), "sections")
