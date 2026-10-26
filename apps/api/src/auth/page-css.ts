/** Styles for the server-rendered auth pages, kept in step with the web app's look. */
export const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#faf7f5;color:#171717;
  font:14px/1.5 Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif}
.card{width:100%;max-width:480px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.06)}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:-.01em;margin-bottom:28px}
.logo{width:32px;height:32px;flex:none}
.badge{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:#171717;color:#fff;font-size:12px;font-weight:500}
h1{margin:0 0 6px;font-size:24px;line-height:1.25;letter-spacing:-.015em}
.lead{margin:0 0 20px;color:#5c606a}
.personas{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.persona{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e4e5e9;border-radius:10px;color:inherit;text-decoration:none;transition:border-color .15s,background .15s}
.persona:hover{border-color:#171717;background:#fafafa}
.persona:focus-visible{outline:2px solid #c8431e;outline-offset:2px}
.avatar{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#fde4da;color:#c8431e;font-weight:600;font-size:13px}
.who{flex:1;min-width:0;display:flex;flex-direction:column}
.who strong{font-weight:600}
.who span{color:#6b6f78;font-size:12.5px}
.role{flex:none;padding:2px 9px;border-radius:999px;background:#f1f1f3;color:#3d4048;font-size:12px;font-weight:500}
.button{display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:999px;background:#171717;color:#fff;text-decoration:none;font-weight:500}
.button:hover{background:#2b2e35}
`;
