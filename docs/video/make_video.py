"""Builds docs/designflow-tech-stack.mp4: one scene per narration line.

Usage: python3 docs/video/make_video.py [voice]
  voice: a macOS `say` voice (default: Samantha),
         "elevenlabs" (needs ELEVENLABS_API_KEY; ELEVENLABS_VOICE_ID optional), or
         "openai"     (needs OPENAI_API_KEY; OPENAI_VOICE optional, default "coral").
Only the narration text is sent to ElevenLabs / OpenAI.
"""

import json
import os
import urllib.request
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

VOICE = sys.argv[1] if len(sys.argv) > 1 else "Samantha"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "designflow-tech-stack.mp4")
W, H, FPS = 1280, 720, 15
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
f = lambda size, bold=False: ImageFont.truetype(FONT, size, index=1 if bold else 0)
F_KICK, F_TITLE, F_CHIP, F_SUB, F_CAP = f(18), f(44, True), f(22, True), f(16), f(20)

BG, INK, MUTED, LINE = (250, 248, 245), (28, 25, 23), (120, 113, 108), (220, 216, 210)
RAMPS = {
    "gray": ((241, 239, 232), (95, 94, 90), (44, 44, 42)),
    "purple": ((238, 237, 254), (83, 74, 183), (60, 52, 137)),
    "teal": ((225, 245, 238), (15, 110, 86), (8, 80, 65)),
    "coral": ((250, 236, 231), (153, 60, 29), (113, 43, 19)),
    "amber": ((250, 238, 218), (133, 79, 11), (99, 56, 6)),
    "blue": ((230, 241, 251), (24, 95, 165), (12, 68, 124)),
}

# (kicker, title, colour, [(chip, what it does)], narration)
SCENES = [
    ("DesignFlow", "The complete tech stack", "purple",
     [("TypeScript", "one language everywhere"), ("Monorepo", "npm workspaces")],
     "DesignFlow is our delivery tracker. In the next minute, let's walk through everything it's built with."),
    ("The big picture", "One repository, three parts", "gray",
     [("apps/web", "what you see"), ("apps/api", "the server"), ("packages/shared", "common types")],
     "It's a single TypeScript project with three parts. A web app that you see, an API server behind it, and a shared package that keeps both speaking the same language."),
    ("Front end", "The web app", "blue",
     [("React 19", "user interface"), ("Vite 8", "build and live reload"), ("Tailwind CSS 4", "styling"),
      ("shadcn + Radix", "dropdowns, panels"), ("TanStack Query", "fetching data"), ("Recharts", "charts"),
      ("React Router 7", "pages"), ("Geist", "font")],
     "The web app is React nineteen, built with Vite, which reloads the page as soon as code changes. It's styled with Tailwind, uses shadcn and Radix for dropdowns and panels, TanStack Query to fetch data, and Recharts for the charts."),
    ("Back end", "The API server", "purple",
     [("Node 22", "runtime"), ("NestJS 11", "API framework"), ("Prisma 7", "database access"),
      ("Zod 4", "checks every input"), ("Pino", "logs"), ("Helmet + CSRF", "security"),
      ("Sessions", "stored in the database"), ("MSAL", "Microsoft sign-in")],
     "The API runs on Node twenty-two with NestJS. Prisma talks to the database, Zod checks every piece of input, and Pino writes the logs. Helmet, secure sessions and CSRF tokens keep it locked down."),
    ("Data", "Where the data lives", "teal",
     [("PostgreSQL 17", "the database"), ("Azure DevOps API", "read-only source"), ("Sync", "every 10 seconds"),
      ("UTC dates", "shown in local time")],
     "All the data lives in PostgreSQL. Every ten seconds, a sync job reads only the latest changes from Azure DevOps, which we never write to, and saves them. Dates are stored in UTC and shown in your local time."),
    ("Hosting and quality", "How it ships", "amber",
     [("Docker", "one image"), ("Azure App Service", "hosting"), ("Entra ID", "company sign-in"),
      ("Key Vault", "secrets"), ("Jest + Vitest", "tests"), ("ESLint + Prettier", "code style")],
     "It ships as one Docker image on Azure, with company sign-in through Entra ID and secrets kept in Key Vault. Jest and Vitest run the tests, and ESLint and Prettier keep the code tidy. That's the whole stack."),
]


def mix(c, a, base=BG):
    return tuple(int(base[i] + (c[i] - base[i]) * a) for i in range(3))


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def frame(i_scene, t, total_t):
    kicker, title, ramp, chips, _ = SCENES[i_scene]
    fill, stroke, text = RAMPS[ramp]
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    a = ease(t * 5)
    d.text((80, 80), kicker.upper(), font=F_KICK, fill=mix(stroke, a))
    d.text((80, 108 + (1 - a) * 10), title, font=F_TITLE, fill=mix(INK, a))
    cols = 4 if len(chips) > 4 else 2 if len(chips) <= 2 else 3
    cw, ch, gx, gy = (W - 160 - (cols - 1) * 20) // cols, 96, 20, 20
    for k, (name, sub) in enumerate(chips):
        ca = ease((t - 0.08 - k * 0.6 / len(chips)) * 6)
        if ca <= 0:
            continue
        x = 80 + (k % cols) * (cw + gx)
        y = 210 + (k // cols) * (ch + gy) + (1 - ca) * 16
        d.rounded_rectangle((x, y, x + cw, y + ch), 16, fill=mix(fill, ca), outline=mix(stroke, ca), width=2)
        d.text((x + 22, y + 36), name, font=F_CHIP, fill=mix(text, ca), anchor="lm")
        d.text((x + 22, y + 66), sub, font=F_SUB, fill=mix(stroke, ca), anchor="lm")
    # Scene dots and overall progress.
    for k in range(len(SCENES)):
        d.ellipse((W - 80 - (len(SCENES) - k) * 22, 88, W - 70 - (len(SCENES) - k) * 22, 98),
                  fill=INK if k == i_scene else LINE)
    d.rectangle((0, H - 6, W, H), fill=LINE)
    d.rectangle((0, H - 6, int(W * total_t), H), fill=stroke)
    return im


def duration(path):
    out = subprocess.run(["afinfo", path], capture_output=True, text=True).stdout
    return float(next(l for l in out.splitlines() if "estimated duration" in l).split(":")[1].split()[0])


def post_audio(url, headers, body, path):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=120) as res, open(path, "wb") as fh:
        fh.write(res.read())


def speak(text, base):
    """Writes the narration for one scene and returns the audio file path."""
    if VOICE == "elevenlabs":
        path = base + ".mp3"
        voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        post_audio(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                   {"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
                   {"text": text, "model_id": "eleven_multilingual_v2"}, path)
    elif VOICE == "openai":
        path = base + ".wav"
        post_audio("https://api.openai.com/v1/audio/speech",
                   {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                   {"model": "gpt-4o-mini-tts", "voice": os.environ.get("OPENAI_VOICE", "coral"), "input": text,
                    "instructions": "Warm, friendly and clear, like a colleague explaining a project.",
                    "response_format": "wav"}, path)
    else:
        path = base + ".aiff"
        subprocess.run(["say", "-v", VOICE, "-r", "185", "-o", path, text], check=True)
    return path


def check_voice():
    if VOICE in ("elevenlabs", "openai"):
        key = "ELEVENLABS_API_KEY" if VOICE == "elevenlabs" else "OPENAI_API_KEY"
        if not os.environ.get(key):
            sys.exit(f"{key} is not set.")
        return
    # `say` silently falls back to the default voice for an unknown name, so check first.
    voices = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    if not any(line.startswith(VOICE + " ") for line in voices.splitlines()):
        sys.exit(f'Voice "{VOICE}" is not installed (see: say -v "?").')


def main():
    check_voice()
    tmp = tempfile.mkdtemp()
    try:
        audio, lengths = [], []
        for i, scene in enumerate(SCENES):
            p = speak(scene[4], os.path.join(tmp, f"s{i}"))
            audio.append(p)
            lengths.append(duration(p) + 0.7)  # a short breath between scenes
        total = sum(lengths)
        frames_dir = os.path.join(tmp, "frames")
        os.mkdir(frames_dir)
        n, start = 0, 0.0
        for i, length in enumerate(lengths):
            count = int(length * FPS)
            for j in range(count):
                frame(i, j / count, (start + j / FPS) / total).save(os.path.join(frames_dir, f"{n:05d}.png"))
                n += 1
            start += length
        # Each scene's audio padded to its scene length, then joined.
        padded = []
        for i, (p, length) in enumerate(zip(audio, lengths)):
            q = os.path.join(tmp, f"p{i}.wav")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", p, "-af", f"apad=whole_dur={length}", "-ar", "44100", "-ac", "1", q], check=True)
            padded.append(q)
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as fh:
            fh.writelines(f"file '{q}'\n" for q in padded)
        voice = os.path.join(tmp, "voice.wav")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, voice], check=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames_dir, "%05d.png"),
                        "-i", voice, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                        "-shortest", "-movflags", "+faststart", OUT], check=True)
        shutil.copy(voice, os.path.join(HERE, "..", "designflow-tech-stack-voice.wav"))
        print(f"{OUT}  {total:.1f}s  voice={VOICE}")
    finally:
        shutil.rmtree(tmp)


if __name__ == "__main__":
    main()
