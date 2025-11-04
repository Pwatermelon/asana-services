import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#9305F2",
        secondary: "#C763F2",
        accent: "#F2C53D",
        warning: "#D97904",
        light: "#F2F2F2",
      },
    },
  },
  plugins: [],
} satisfies Config;
