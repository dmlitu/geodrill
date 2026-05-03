import { createContext, useContext, useState } from "react"
import tr from "./locales/tr.json"
import en from "./locales/en.json"
import ru from "./locales/ru.json"

const LANGS = { tr, en, ru }
const LANG_ORDER = ["tr", "en", "ru"]

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("gd_lang")
    return LANG_ORDER.includes(saved) ? saved : "tr"
  })

  const toggleLang = () => {
    setLang(prev => {
      const idx = LANG_ORDER.indexOf(prev)
      const next = LANG_ORDER[(idx + 1) % LANG_ORDER.length]
      localStorage.setItem("gd_lang", next)
      return next
    })
  }

  const t = (key) => LANGS[lang]?.[key] ?? LANGS.en?.[key] ?? LANGS.tr[key] ?? key

  return (
    <LangContext.Provider value={{ lang, t, toggleLang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  return useContext(LangContext)
}
