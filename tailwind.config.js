import defaultTheme from "tailwindcss/defaultTheme"
import tailwindForms from "@tailwindcss/forms"

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist Sans", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [tailwindForms],
}

