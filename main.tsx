@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&family=JetBrains+Mono:wght@400;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

@layer base {
  body {
    @apply bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900;
    background-image: 
      radial-gradient(at 0% 0%, hsla(253,16%,7%,0.015) 0, transparent 50%), 
      radial-gradient(at 50% 0%, hsla(225,39%,30%,0.015) 0, transparent 50%), 
      radial-gradient(at 100% 0%, hsla(339,49%,30%,0.015) 0, transparent 50%);
    background-attachment: fixed;
  }
}
