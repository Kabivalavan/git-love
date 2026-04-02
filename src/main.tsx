import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/themes.css";

const rootElement = document.getElementById("root")!;

rootElement.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:hsl(210 20% 98%);color:hsl(215 25% 15%);font-family:system-ui,-apple-system,sans-serif;">
    <div style="max-width:360px;text-align:center;display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;width:112px;height:112px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;inset:8px;border-radius:9999px;border:1px solid hsl(211 100% 50% / 0.18);background:hsl(211 100% 50% / 0.06);animation:pulse 2.6s ease-in-out infinite;"></span>
        <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
          <circle cx="60" cy="60" r="42" fill="none" stroke="hsl(211 100% 50% / 0.12)" stroke-width="8"></circle>
          <path d="M60 28c12 10 18 20 18 31 0 12-8 22-18 32-10-10-18-20-18-32 0-11 6-21 18-31Z" fill="hsl(211 100% 50% / 0.16)"></path>
          <path d="M60 40c7 6 10 12 10 19 0 7-4 14-10 20-6-6-10-13-10-20 0-7 3-13 10-19Z" fill="hsl(211 100% 50%)"></path>
        </svg>
      </div>
      <div style="margin-top:24px;font-size:24px;font-weight:600;">Take a deep breath</div>
      <div style="margin-top:8px;font-size:14px;color:hsl(215 15% 45%);">Hold on while we prepare your store.</div>
    </div>
  </div>
`;

createRoot(rootElement).render(<App />);
