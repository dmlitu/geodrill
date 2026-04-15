import { createContext, useContext, useState } from "react"
import { translations } from "./i18n"

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("gd_lang") || "tr")

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === "tr" ? "en" : "tr"
      localStorage.setItem("gd_lang", next)
      return next
    })
  }

  const t = (key) => translations[lang]?.[key] ?? translations.tr[key] ?? key

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
