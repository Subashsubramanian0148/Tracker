"""Draws docs/designflow-tech-stack.png: the tech stack in five layers, what each tool is and does."""

import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "designflow-tech-stack.png")
S = 2  # draw at 2x for a crisp image
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
f = lambda size, bold=False: ImageFont.truetype(FONT, size * S, index=1 if bold else 0)
F_T, F_ST, F_LH, F_LS, F_CH, F_CW, F_CU, F_P = f(34, True), f(16), f(20, True), f(14), f(16, True), f(13), f(14), f(14)

BG, INK, MUTED, LINE, WHITE = (250, 248, 245), (28, 25, 23), (120, 113, 108), (222, 218, 212), (255, 255, 255)
LAYERS = [
    ("Front end", "What you see in the browser", ((230, 241, 251), (24, 95, 165)), [
        ("React 19", "Builds screens from reusable pieces", "StoryCard written once, shown 152 times"),
        ("Vite 8", "Build tool and dev server", "Page updates the moment code is saved"),
        ("Tailwind CSS 4", "Styling with short class names", "All colours, spacing and layout"),
        ("shadcn + Radix", "Ready-made accessible UI parts", "Stage and Sort dropdowns, panels"),
        ("TanStack Query", "Fetches and remembers data", "Instant page switches, auto refresh"),
        ("Recharts", "Chart library", "Bars and charts on the Overview"),
        ("React Router 7", "Page navigation without reloads", "Overview, Board, story pages"),
        ("Geist", "Typeface", "All text and the bold numbers"),
    ]),
    ("Back end", "The API server behind the app", ((238, 237, 254), (83, 74, 183)), [
        ("Node 22", "Runs TypeScript on a server", "The engine the API runs on"),
        ("NestJS 11", "Organises server code into modules", "Sync, metrics, auth, admin kept apart"),
        ("Prisma 7", "Database toolkit (ORM)", "Reads/writes data; migrations shape tables"),
        ("Zod 4", "Checks data has the right shape", "Rejects bad input and odd Azure replies"),
        ("Pino", "Fast structured logger", "Records syncs and errors for tracing"),
    ]),
    ("Security", "Who gets in and what's blocked", ((250, 236, 231), (153, 60, 29)), [
        ("Helmet", "Security headers on every page", "Blocks framing and injected scripts"),
        ("CSRF tokens", "Secret sent with every change", "Other sites can't act as you"),
        ("Sessions", "Server-side record of who's signed in", "Ends after 30 min idle or 8 hours"),
        ("MSAL", "Microsoft sign-in library", "Sign in with Microsoft, @cspl.com only"),
        ("Entra ID", "Company Microsoft accounts", "IT controls who has access"),
        ("Key Vault", "Azure's safe for secrets", "Passwords and keys never in files"),
    ]),
    ("Data", "Where it comes from and lives", ((225, 245, 238), (15, 110, 86)), [
        ("PostgreSQL 17", "The database", "Azure copy, metrics, our own data"),
        ("Azure DevOps API", "Microsoft's boards interface", "Our source: read-only, never edited"),
        ("Sync job", "Background task every 10 seconds", "Fetches only what changed"),
        ("UTC dates", "One universal time zone", "Stored once, shown in local time"),
    ]),
    ("Hosting and quality", "How it ships and stays healthy", ((250, 238, 218), (133, 79, 11)), [
        ("TypeScript", "JavaScript with types", "Catches mistakes before the app runs"),
        ("npm workspaces", "Several projects in one repo", "Web, API, shared code installed together"),
        ("Docker", "Packs the app into one image", "Runs the same everywhere"),
        ("Azure App Service", "Managed hosting", "HTTPS, restarts, scaling handled"),
        ("Jest + Vitest", "Automated tests", "56 API and 42 web tests"),
        ("ESLint + Prettier", "Code checker and formatter", "Clean, consistent code"),
    ]),
]
FLOW = ["Browser", "Web app", "API server", "PostgreSQL", "Sync", "Azure DevOps"]

W, PAD, COLS, CW, CH, G = 1600, 48, 4, 0, 96, 14
CW = (W - 2 * PAD - 2 * 20 - (COLS - 1) * G) // COLS


def layer_h(n):
    rows = (n + COLS - 1) // COLS
    return 70 + rows * CH + (rows - 1) * G + 20


H = 230 + sum(layer_h(len(l[3])) + 18 for l in LAYERS) + 30
im = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(im)
s = lambda *v: tuple(int(x * S) for x in v)

d.text(s(PAD, 44), "DesignFlow tech stack", font=F_T, fill=INK)
d.text(s(PAD, 90), "What each tool is, and what it does for us", font=F_ST, fill=MUTED)

# Data path strip.
x, y = PAD, 140
for i, name in enumerate(FLOW):
    w = d.textlength(name, font=F_P) / S + 32
    d.rounded_rectangle(s(x, y, x + w, y + 36), 18 * S, fill=WHITE, outline=LINE, width=S)
    d.text(s(x + w / 2, y + 18), name, font=F_P, fill=INK, anchor="mm")
    x += w
    if i < len(FLOW) - 1:
        # Data travels from Azure DevOps toward the browser, so every arrow points left.
        x1, x2, ym = x + 7, x + 25, y + 18
        tip, base = x1, x1 + 7
        d.line(s(x1, ym, x2, ym), fill=MUTED, width=2 * S)
        d.polygon([s(tip, ym), s(base, ym - 5), s(base, ym + 5)], fill=MUTED)
        x += 32
d.text(s(x + 16, y + 18), "how data moves", font=F_LS, fill=MUTED, anchor="lm")

y = 200
for title, sub, (tint, strong), cards in LAYERS:
    h = layer_h(len(cards))
    d.rounded_rectangle(s(PAD, y, W - PAD, y + h), 18 * S, fill=tint, outline=strong, width=S)
    d.rounded_rectangle(s(PAD + 20, y + 24, PAD + 34, y + 38), 4 * S, fill=strong)
    d.text(s(PAD + 46, y + 31), title, font=F_LH, fill=strong, anchor="lm")
    d.text(s(PAD + 46 + d.textlength(title, font=F_LH) / S + 14, y + 32), sub, font=F_LS, fill=MUTED, anchor="lm")
    for k, (name, what, us) in enumerate(cards):
        cx = PAD + 20 + (k % COLS) * (CW + G)
        cy = y + 58 + (k // COLS) * (CH + G)
        d.rounded_rectangle(s(cx, cy, cx + CW, cy + CH), 12 * S, fill=WHITE, outline=LINE, width=S)
        d.text(s(cx + 16, cy + 24), name, font=F_CH, fill=INK, anchor="lm")
        d.text(s(cx + 16, cy + 48), what, font=F_CW, fill=MUTED, anchor="lm")
        d.text(s(cx + 16, cy + 72), us, font=F_CU, fill=strong, anchor="lm")
    y += h + 18

im.save(OUT, optimize=True)
print(OUT, im.size)
