import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTsZk-iRULb3dB0H7rpZ44vEWjt330mkc",
  authDomain: "ie-lideranca.firebaseapp.com",
  projectId: "ie-lideranca",
  storageBucket: "ie-lideranca.firebasestorage.app",
  messagingSenderId: "405923605074",
  appId: "1:405923605074:web:c1aa2b79b80c9b71e2cd8b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_KEY;

const cache = {};

async function translateText(text, targetLang) {
  if (!text || targetLang === "pt") return text;
  const key = `${targetLang}::${text}`;
  if (cache[key]) return cache[key];
  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: "pt", target: targetLang, format: "text" })
    });
    const data = await res.json();
    const translated = data?.data?.translations?.[0]?.translatedText || text;
    cache[key] = translated;
    return translated;
  } catch { return text; }
}

async function translateObj(obj, fields, lang) {
  if (lang === "pt") return obj;
  const results = await Promise.all(fields.map(f => translateText(obj[f], lang)));
  const updated = { ...obj };
  fields.forEach((f, i) => { updated[f] = results[i]; });
  return updated;
}

// ── Responsive hook ──────────────────────────────────────────────────────────
function useScreenSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const isTablet = size.w >= 768;
  const isDesktop = size.w >= 1024;
  const isSmallPhone = size.w < 375;
  return { ...size, isTablet, isDesktop, isSmallPhone };
}
// ────────────────────────────────────────────────────────────────────────────

const defaultAuthor = {
  name: "Ana Beatriz Mendes",
  title: "Psicóloga & Coach de Desenvolvimento Humano",
  bio: "Com mais de 15 anos dedicados ao desenvolvimento humano, acredito que a inteligência emocional é a habilidade mais transformadora que um ser humano pode cultivar.",
  avatar: "👩‍💼",
  stat1Label: "Anos de Experiência", stat1Value: "15+",
  stat2Label: "Pessoas Impactadas", stat2Value: "2K+",
  stat3Label: "Publicações", stat3Value: "47",
  mission: "Acredito que quando desenvolvemos nossa inteligência emocional, transformamos não só nossa vida profissional, mas todos os relacionamentos que cultivamos.",
};

const defaultAppearance = {
  appName: "IE & Liderança", appSubtitle: "Inteligência Emocional & Soft Skills",
  appIcon: "🧠", footerText: "Inteligência Emocional & Liderança",
  colorPrimary: "#1E3A5F", colorSecondary: "#2E6DA4", bgColor: "#F0F4F8",
  showFooter: true, showSubtitle: true, gridCols: 2,
};

const defaultCategories = [
  { id: "autoconhecimento", label: "Autoconhecimento", color: "#FF6B6B", active: true },
  { id: "empatia", label: "Empatia", color: "#4ECDC4", active: true },
  { id: "resiliencia", label: "Resiliência", color: "#45B7D1", active: true },
  { id: "comunicacao", label: "Comunicação", color: "#96CEB4", active: true },
  { id: "lideranca", label: "Liderança", color: "#FFEAA7", active: true },
  { id: "autogestao", label: "Autogestão", color: "#DDA0DD", active: true },
];

const ui = {
  pt: { home: "Início", author: "Autor", all: "Todas",
    loading: "⏳ Carregando...", translating: "⟳ Traduzindo...",
    noMessages: "Nenhuma mensagem ainda.",
    reflect: "💭 Reflita sobre isso",
    reflectSub: "Como você pode aplicar essa ideia no seu dia a dia?",
    back: "← Voltar", about: "Sobre", mission: "Missão" },
  en: { home: "Home", author: "Author", all: "All",
    loading: "⏳ Loading...", translating: "⟳ Translating...",
    noMessages: "No messages yet.",
    reflect: "💭 Reflect on this",
    reflectSub: "How can you apply this idea in your daily life?",
    back: "← Back", about: "About", mission: "Mission" }
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("todas");
  const [author, setAuthor] = useState(defaultAuthor);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [categories, setCategories] = useState(defaultCategories);
  const [lang, setLang] = useState("pt");
  const [translatedMessages, setTranslatedMessages] = useState([]);
  const [translatedAuthor, setTranslatedAuthor] = useState(null);
  const [translatedCats, setTranslatedCats] = useState(null);
  const [translating, setTranslating] = useState(false);
  const screen$ = useScreenSize();

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs); setTranslatedMessages(msgs); setLoading(false);
    });
  }, []);

  useEffect(() => { return onSnapshot(doc(db, "config", "author"), (d) => { if (d.exists()) setAuthor({ ...defaultAuthor, ...d.data() }); }); }, []);
  useEffect(() => { return onSnapshot(doc(db, "config", "appearance"), (d) => { if (d.exists()) setAppearance({ ...defaultAppearance, ...d.data() }); }); }, []);
  useEffect(() => { return onSnapshot(doc(db, "config", "categories"), (d) => { if (d.exists() && d.data().list) setCategories(d.data().list); }); }, []);

  const switchLang = useCallback(async (newLang) => {
    if (newLang === lang) return;
    setLang(newLang);
    if (newLang === "pt") {
      setTranslatedMessages(messages); setTranslatedAuthor(null); setTranslatedCats(null); return;
    }
    setTranslating(true);
    try {
      const [tMsgs, tAuthor, tCats] = await Promise.all([
        Promise.all(messages.map(m => translateObj(m, ["title", "content"], newLang))),
        translateObj(author, ["title", "bio", "mission", "stat1Label", "stat2Label", "stat3Label"], newLang),
        Promise.all(categories.map(c => translateObj(c, ["label"], newLang))),
      ]);
      setTranslatedMessages(tMsgs); setTranslatedAuthor(tAuthor); setTranslatedCats(tCats);
    } finally { setTranslating(false); }
  }, [lang, messages, author, categories]);

  const displayMessages = lang === "pt" ? messages : translatedMessages;
  const displayAuthor = lang === "pt" ? author : (translatedAuthor || author);
  const displayCats = lang === "pt" ? categories : (translatedCats || categories);
  const t = ui[lang];
  const activeCats = displayCats.filter(c => c.active !== false);
  const getCat = (id) => displayCats.find(c => c.id === id) || categories.find(c => c.id === id) || { label: id, color: "#999" };
  const grad = `linear-gradient(135deg, ${appearance.colorPrimary}, ${appearance.colorSecondary})`;

  // Responsive values
  const R = {
    maxW: screen$.isDesktop ? 1100 : screen$.isTablet ? 768 : "100%",
    cols: screen$.isDesktop
      ? (appearance.gridCols === 1 ? 2 : appearance.gridCols === 2 ? 4 : 5)
      : screen$.isTablet
      ? (appearance.gridCols === 1 ? 1 : appearance.gridCols === 2 ? 3 : 4)
      : (appearance.gridCols || 2),
    pad: screen$.isTablet ? "24px 32px 40px" : screen$.isSmallPhone ? "14px 14px 24px" : "20px 20px 32px",
    fontSize: { badge: screen$.isTablet ? 18 : 16, subtitle: screen$.isTablet ? 15 : 13, card: screen$.isTablet ? 15 : 13 },
    tabH: screen$.isTablet ? 72 : 80,
    tabPad: screen$.isTablet ? "0 48px" : "0 36px",
    avatarSize: screen$.isTablet ? 130 : 100,
    cardPad: screen$.isTablet ? 20 : 16,
    iconSize: screen$.isTablet ? 70 : 56,
    iconFont: screen$.isTablet ? 36 : 30,
  };

  const LangSwitcher = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "4px 10px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <button onClick={() => switchLang("pt")} style={{ background: "none", border: "none", fontSize: screen$.isTablet ? 26 : 22, cursor: "pointer", padding: "2px 4px", opacity: lang === "pt" ? 1 : 0.4, transform: lang === "pt" ? "scale(1.2)" : "scale(1)", transition: "all 0.2s" }}>🇧🇷</button>
      <button onClick={() => switchLang("en")} style={{ background: "none", border: "none", fontSize: screen$.isTablet ? 26 : 22, cursor: "pointer", padding: "2px 4px", opacity: lang === "en" ? 1 : 0.4, transform: lang === "en" ? "scale(1.2)" : "scale(1)", transition: "all 0.2s" }}>🇺🇸</button>
      {translating && <span style={{ fontSize: 13, color: "#6B7280" }}>⟳</span>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", width: "100%", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", background: appearance.bgColor }}>
      {/* Tablet/Desktop: sidebar layout */}
      {screen$.isTablet ? (
        <div style={{ display: "flex", flex: 1, maxWidth: R.maxW, margin: "0 auto", width: "100%" }}>
          {/* Sidebar nav */}
          <div style={{ width: 220, background: `linear-gradient(180deg, ${appearance.colorPrimary} 0%, ${appearance.colorSecondary} 100%)`, display: "flex", flexDirection: "column", padding: "32px 0", gap: 4, flexShrink: 0, minHeight: "100dvh", position: "sticky", top: 0 }}>
            <div style={{ padding: "0 24px 32px" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{appearance.appIcon || "🧠"}</div>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 18, margin: "0 0 4px", lineHeight: 1.2 }}>{appearance.appName}</p>
              {appearance.showSubtitle !== false && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: 0 }}>{appearance.appSubtitle}</p>}
            </div>
            {[{ id: "home", icon: appearance.appIcon || "🧠", label: t.home },
              { id: "author", icon: "👤", label: t.author }].map(tab => (
              <button key={tab.id} onClick={() => setScreen(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", background: screen === tab.id ? "rgba(255,255,255,0.15)" : "transparent", border: "none", cursor: "pointer", color: "#fff", fontWeight: screen === tab.id ? 700 : 500, fontSize: 15, textAlign: "left", borderLeft: screen === tab.id ? "3px solid #fff" : "3px solid transparent" }}>
                <span style={{ fontSize: 20 }}>{tab.icon}</span>{tab.label}
              </button>
            ))}
            <div style={{ marginTop: "auto", padding: "24px" }}>
              <LangSwitcher />
            </div>
            {appearance.showFooter !== false && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", padding: "0 16px 16px", margin: 0 }}>{appearance.footerText}</p>
            )}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflowY: "auto", padding: R.pad }}>
            {screen === "home" && (
              <HomeContent messages={displayMessages} loading={loading} translating={translating}
                activeTab={activeTab} setActiveTab={setActiveTab} setScreen={setScreen}
                setSelectedMessage={setSelectedMessage} appearance={appearance} grad={grad}
                activeCats={activeCats} getCat={getCat} t={t} R={R} isTablet={true} />
            )}
            {screen === "author" && <AuthorContent author={displayAuthor} grad={grad} appearance={appearance} t={t} R={R} isTablet={true} />}
            {screen === "detail" && selectedMessage && (
              <DetailContent message={selectedMessage} setScreen={setScreen} appearance={appearance}
                grad={grad} getCat={getCat} t={t} displayMessages={displayMessages} R={R} isTablet={true} />
            )}
          </div>
        </div>
      ) : (
        // Mobile layout
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {screen === "home" && (
              <HomeScreen messages={displayMessages} loading={loading} translating={translating}
                activeTab={activeTab} setActiveTab={setActiveTab} setScreen={setScreen}
                setSelectedMessage={setSelectedMessage} appearance={appearance} grad={grad}
                activeCats={activeCats} getCat={getCat} t={t} R={R} LangSwitcher={LangSwitcher} />
            )}
            {screen === "author" && <AuthorScreen author={displayAuthor} grad={grad} appearance={appearance} t={t} R={R} LangSwitcher={LangSwitcher} />}
            {screen === "detail" && selectedMessage && (
              <DetailScreen message={selectedMessage} setScreen={setScreen} appearance={appearance}
                grad={grad} getCat={getCat} t={t} displayMessages={displayMessages} R={R} />
            )}
          </div>
          <div style={{ height: R.tabH, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
            {[{ id: "home", icon: appearance.appIcon || "🧠", label: t.home },
              { id: "author", icon: "👤", label: t.author }].map((tab) => (
              <button key={tab.id} onClick={() => setScreen(tab.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 3, padding: R.tabPad, color: screen === tab.id ? appearance.colorPrimary : "#9CA3AF" }}>
                <span style={{ fontSize: R.tabH === 72 ? 28 : 24 }}>{tab.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{tab.label}</span>
              </button>
            ))}
            <button onClick={() => {}} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", gap: 3, padding: R.tabPad }}>
              <LangSwitcher />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile screens ───────────────────────────────────────────────────────────

function HomeScreen({ messages, loading, translating, activeTab, setActiveTab, setScreen, setSelectedMessage, appearance, grad, activeCats, getCat, t, R, LangSwitcher }) {
  const filtered = activeTab === "todas" ? messages : messages.filter(m => m.category === activeTab);
  return (
    <div style={{ padding: R.pad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: grad, borderRadius: 20, padding: "6px 14px", marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{appearance.appIcon || "🧠"}</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: R.fontSize.badge, letterSpacing: -0.5 }}>{appearance.appName}</span>
          </div>
          {appearance.showSubtitle !== false && <p style={{ color: "#6B7280", fontSize: R.fontSize.subtitle, margin: 0 }}>{appearance.appSubtitle}</p>}
        </div>
      </div>
      <CategoryRow activeCats={activeCats} activeTab={activeTab} setActiveTab={setActiveTab} appearance={appearance} t={t} />
      <MessageGrid messages={filtered} loading={loading} translating={translating} getCat={getCat} setSelectedMessage={setSelectedMessage} setScreen={setScreen} t={t} R={R} />
      {appearance.showFooter !== false && <p style={{ textAlign: "center", fontSize: 10, color: "#B0B8C4", marginTop: 24, marginBottom: 0, fontStyle: "italic" }}>{appearance.footerText}</p>}
    </div>
  );
}

function DetailScreen({ message, setScreen, appearance, grad, getCat, t, displayMessages, R }) {
  const displayed = displayMessages?.find(m => m.id === message.id) || message;
  const cat = getCat(message.category);
  return (
    <div style={{ padding: R.pad }}>
      <button onClick={() => setScreen("home")} style={{ background: "#fff", border: "none", color: appearance.colorPrimary, fontWeight: 700, fontSize: 16, cursor: "pointer", padding: "8px 16px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>{t.back}</button>
      <DetailBody message={message} displayed={displayed} cat={cat} appearance={appearance} grad={grad} t={t} R={R} />
    </div>
  );
}

function AuthorScreen({ author, grad, appearance, t, R, LangSwitcher }) {
  return (
    <div style={{ padding: R.pad }}>
      <AuthorBody author={author} grad={grad} appearance={appearance} t={t} R={R} />
    </div>
  );
}

// ── Tablet content (no scroll wrapper needed) ────────────────────────────────

function HomeContent({ messages, loading, translating, activeTab, setActiveTab, setScreen, setSelectedMessage, appearance, grad, activeCats, getCat, t, R, isTablet }) {
  const filtered = activeTab === "todas" ? messages : messages.filter(m => m.category === activeTab);
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 20px" }}>{t.home}</h1>
      <CategoryRow activeCats={activeCats} activeTab={activeTab} setActiveTab={setActiveTab} appearance={appearance} t={t} large={isTablet} />
      <MessageGrid messages={filtered} loading={loading} translating={translating} getCat={getCat} setSelectedMessage={setSelectedMessage} setScreen={setScreen} t={t} R={R} />
      {appearance.showFooter !== false && <p style={{ textAlign: "center", fontSize: 11, color: "#B0B8C4", marginTop: 32, fontStyle: "italic" }}>{appearance.footerText}</p>}
    </div>
  );
}

function DetailContent({ message, setScreen, appearance, grad, getCat, t, displayMessages, R, isTablet }) {
  const displayed = displayMessages?.find(m => m.id === message.id) || message;
  const cat = getCat(message.category);
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <button onClick={() => setScreen("home")} style={{ background: "#fff", border: "none", color: appearance.colorPrimary, fontWeight: 700, fontSize: 16, cursor: "pointer", padding: "10px 20px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 32 }}>{t.back}</button>
      <DetailBody message={message} displayed={displayed} cat={cat} appearance={appearance} grad={grad} t={t} R={R} />
    </div>
  );
}

function AuthorContent({ author, grad, appearance, t, R, isTablet }) {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 24px" }}>{t.author}</h1>
      <AuthorBody author={author} grad={grad} appearance={appearance} t={t} R={R} />
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function CategoryRow({ activeCats, activeTab, setActiveTab, appearance, t, large }) {
  return (
    <div style={{ display: "flex", gap: large ? 10 : 8, overflowX: "auto", marginBottom: large ? 28 : 20, paddingBottom: 4, scrollbarWidth: "none", flexWrap: large ? "wrap" : "nowrap" }}>
      {[{ id: "todas", label: t.all }, ...activeCats].map(cat => (
        <button key={cat.id} onClick={() => setActiveTab(cat.id)}
          style={{ padding: large ? "10px 20px" : "8px 16px", borderRadius: 20, border: "none", fontSize: large ? 14 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: activeTab === cat.id ? appearance.colorPrimary : "#F3F4F6", color: activeTab === cat.id ? "#fff" : "#6B7280" }}>
          {cat.label}
        </button>
      ))}
    </div>
  );
}

function MessageGrid({ messages, loading, translating, getCat, setSelectedMessage, setScreen, t, R }) {
  if (loading) return <div style={{ textAlign: "center", padding: "60px 20px" }}><p style={{ color: "#6B7280", fontSize: 15, margin: 0 }}>{t.loading}</p></div>;
  if (translating) return <div style={{ textAlign: "center", padding: "60px 20px" }}><p style={{ color: "#6B7280", fontSize: 15, margin: 0 }}>{t.translating}</p></div>;
  if (messages.length === 0) return <div style={{ textAlign: "center", padding: "60px 20px" }}><p style={{ color: "#374151", fontSize: 16, fontWeight: 700, margin: 0 }}>{t.noMessages}</p></div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${R.cols}, 1fr)`, gap: R.cols >= 3 ? 16 : 14 }}>
      {messages.map(msg => {
        const cat = getCat(msg.category);
        return (
          <button key={msg.id} style={{ background: "#fff", borderRadius: 20, padding: R.cardPad, border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}
            onClick={() => { setSelectedMessage(msg); setScreen("detail"); }}>
            <div style={{ width: R.iconSize, height: R.iconSize, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: (cat.color || msg.color) + "22" }}>
              <span style={{ fontSize: R.iconFont }}>{msg.icon}</span>
            </div>
            <p style={{ fontSize: R.fontSize.card, fontWeight: 700, color: "#111", margin: 0, lineHeight: 1.3 }}>{msg.title}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5, background: (cat.color || msg.color) + "22", color: cat.color || msg.color }}>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailBody({ message, displayed, cat, appearance, grad, t, R }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <div style={{ width: R.isTablet ? 120 : 100, height: R.isTablet ? 120 : 100, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, background: (cat.color || message.color) + "22" }}>
          <span style={{ fontSize: R.isTablet ? 64 : 52 }}>{message.icon}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5, background: (cat.color || message.color) + "22", color: cat.color || message.color }}>{cat.label}</span>
      </div>
      <h1 style={{ fontSize: R.isTablet ? 28 : 24, fontWeight: 800, color: "#111", textAlign: "center", margin: "0 0 20px", lineHeight: 1.25 }}>{displayed.title}</h1>
      <div style={{ background: "#fff", borderRadius: 20, padding: R.isTablet ? 28 : 20, marginBottom: 16, display: "flex", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 4, background: cat.color || message.color, borderRadius: 4, marginRight: 16, flexShrink: 0 }} />
        <p style={{ fontSize: R.isTablet ? 17 : 16, lineHeight: 1.7, color: "#374151", margin: 0 }}>{displayed.content}</p>
      </div>
      <div style={{ borderRadius: 20, padding: R.isTablet ? 24 : 20, background: `linear-gradient(135deg, ${appearance.colorPrimary}18, ${appearance.colorSecondary}18)` }}>
        <p style={{ fontWeight: 700, fontSize: R.isTablet ? 16 : 15, margin: "0 0 8px", color: appearance.colorPrimary }}>{t.reflect}</p>
        <p style={{ fontSize: R.isTablet ? 15 : 14, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{t.reflectSub}</p>
      </div>
    </div>
  );
}

function AuthorBody({ author, grad, appearance, t, R }) {
  const avatarSize = R.avatarSize;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, background: "linear-gradient(135deg, #DBEAFE, #EFF6FF)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${appearance.colorPrimary}33`, border: "3px solid #fff" }}>
          <span style={{ fontSize: avatarSize * 0.52 }}>{author.avatar}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: R.isTablet ? 28 : 24, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>{author.name}</h1>
        <p style={{ color: appearance.colorPrimary, fontWeight: 600, fontSize: R.isTablet ? 16 : 14, margin: 0 }}>{author.title}</p>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[{ label: author.stat1Label, value: author.stat1Value }, { label: author.stat2Label, value: author.stat2Value }, { label: author.stat3Label, value: author.stat3Value }].map(st => (
          <div key={st.label} style={{ flex: 1, background: "#fff", borderRadius: 16, padding: R.isTablet ? "18px 12px" : "14px 10px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: R.isTablet ? 26 : 22, fontWeight: 800, color: appearance.colorPrimary, margin: "0 0 4px" }}>{st.value}</p>
            <p style={{ fontSize: R.isTablet ? 11 : 10, color: "#9CA3AF", fontWeight: 600, margin: 0 }}>{st.label}</p>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 20, padding: R.isTablet ? 28 : 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <p style={{ fontWeight: 700, fontSize: R.isTablet ? 18 : 16, color: "#111", margin: "0 0 10px" }}>{t.about}</p>
        <p style={{ fontSize: R.isTablet ? 15 : 14, color: "#6B7280", lineHeight: 1.7, margin: 0 }}>{author.bio}</p>
      </div>
      <div style={{ background: grad, borderRadius: 20, padding: R.isTablet ? 28 : 20, textAlign: "center" }}>
        <span style={{ fontSize: 28, marginBottom: 8, display: "block" }}>✨</span>
        <p style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.8)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>{t.mission}</p>
        <p style={{ fontSize: R.isTablet ? 15 : 14, color: "#fff", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>"{author.mission}"</p>
      </div>
    </div>
  );
}
