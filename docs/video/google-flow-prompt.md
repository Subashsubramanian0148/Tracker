# DesignFlow tech stack explainer: Google Flow prompts

About 64 seconds, as 8 shots of 8 seconds each (Flow/Veo makes 8-second clips). Generate each shot
separately, then join them in order with Flow's scene builder.

## Paste this style block at the start of every shot

> Clean, modern motion-graphics explainer for a software team. Flat 2D design on a warm off-white
> background (#FAF8F5), soft rounded cards with thin outlines, pastel accents: lavender (#EEEDFE /
> #534AB7), mint (#E1F5EE / #0F6E56), coral (#FAECE7 / #993C1D), sky blue (#E6F1FB / #185FA5).
> Smooth ease-in-out motion, cards gently sliding up and fading in, small glowing dots travelling
> along thin connector lines. Calm and professional, no people, no photorealism, no 3D, no neon, no
> clutter. Camera static or very slow push-in. 16:9, 1080p.
> Voiceover: a warm, friendly, natural female voice with a neutral English accent, like a colleague
> explaining a project, unhurried pace. Soft, light ambient background music, low volume. No sound
> effects except a very subtle soft "pop" when a card appears.

Keep on-screen text to the short labels given in each shot. Long text gets garbled, so add any extra
titles afterwards in the editor.

---

## Shot 1: Intro (0:00–0:08)

> [style block] A single rounded lavender card in the centre with a small two-square logo icon. The
> word "DesignFlow" appears in bold dark text, then a smaller line below: "Tech stack". Faint grid
> lines drift slowly in the background.
> Voiceover: "This is DesignFlow, our team's delivery tracker. Here's everything it's built with,
> in one minute."

## Shot 2: The big picture (0:08–0:16)

> [style block] One large dashed rounded outline labelled "One repository". Inside it, three cards
> slide in left to right: a sky-blue card "Web app", a lavender card "API server", a mint card
> "Shared types". Thin lines connect the shared card to the other two.
> Voiceover: "It's one TypeScript project with three parts: the web app you see, the server behind
> it, and shared code that keeps them in sync."

## Shot 3: Front end (0:16–0:24)

> [style block] A simple browser window outline in the centre showing a dashboard with soft pastel
> cards and a small bar chart. Around it, small sky-blue labelled chips pop in one by one: "React",
> "Vite", "Tailwind", "Radix", "Recharts".
> Voiceover: "The web app is built with React and Vite, which refreshes the page the moment code
> changes. It's styled with Tailwind, with Radix for menus and Recharts for the charts."

## Shot 4: Back end (0:24–0:32)

> [style block] A lavender server card in the centre labelled "API". Small lavender chips orbit in
> and settle around it: "Node", "NestJS", "Prisma", "Zod". A small padlock icon appears on the card.
> Voiceover: "The server runs on Node with NestJS. Prisma talks to the database, Zod checks every
> input, and secure sign-in keeps the data private."

## Shot 5: The database (0:32–0:40)

> [style block] A mint database cylinder labelled "PostgreSQL". Three stacked mint drawers slide out
> of it one at a time, labelled "Azure DevOps copy", "Computed metrics", "Our own data". A small clock
> icon labelled "UTC" fades in beside it.
> Voiceover: "Everything is stored in PostgreSQL: a copy of Azure DevOps, the metrics we compute from
> it, and data only we keep. Dates are saved in UTC and shown in your local time."

## Shot 6: Data flow (0:40–0:48)

> [style block] A left-to-right pipeline of five rounded cards: grey "Azure DevOps", lavender "Sync",
> mint "Database", lavender "API", grey "Browser". Thin arrows connect them. Small coral dots travel
> along the arrows from left to right in a steady loop. A small circular timer on the "Sync" card
> ticks every few seconds.
> Voiceover: "Every ten seconds, a sync reads only what changed in Azure DevOps (read-only, we never
> edit it), saves it, and the app shows it to you."

## Shot 7: Metrics (0:48–0:56)

> [style block] A neat grid of twelve small pastel tiles flipping in one after another, each with a
> short label: "Delivered", "On time", "Delayed", "Per person", "Time in stage", "Days taken",
> "Mid-sprint changes", "Next sprint", "Reopened", "Estimate vs actual", "Warning signs",
> "Total stories". Top row lavender, middle row mint, bottom row amber.
> Voiceover: "From that data we work out delivery, flow and predictability: what's done, what's late,
> and why."

## Shot 8: Hosting and close (0:56–1:04)

> [style block] A single container box labelled "Docker" lifts gently onto a soft cloud shape
> labelled "Azure". Small chips appear beside it: "Microsoft sign-in", "Key Vault", "Tests". The
> scene then fades back to the "DesignFlow" card from shot 1.
> Voiceover: "It ships as one container on Azure, with company sign-in, secrets in Key Vault, and
> automated tests. That's DesignFlow."

---

## Tips for Flow

- **Model:** use Veo 3 (or the latest Veo), because it can generate the voiceover. Older models make
  silent clips; for those, add the voiceover separately and paste the lines above into a text-to-speech
  tool.
- **Consistency:** reuse the exact style block, and use the frame-to-video / "extend" option from the
  previous shot's last frame so colours and layout carry over.
- **Garbled labels:** regenerate just that shot, or remove the label text from the prompt and add it as
  a title in the editor.
- **Voice changing between shots:** keep the same voice sentence in every prompt. If it still drifts,
  generate the clips without voice and record the full narration once.
