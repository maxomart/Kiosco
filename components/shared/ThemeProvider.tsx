"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { BrandThemeProvider } from "@/lib/brand-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrandThemeProvider>{children}</BrandThemeProvider>
    </NextThemesProvider>
  )
}
