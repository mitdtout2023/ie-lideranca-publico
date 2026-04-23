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

// ── Translation cache & helper ──────────────────────────────────────────────
const translationCache = {};

async function translateText(text, targetLang) {
  if (!text || targetLang === "pt") return text;
  const key = `${targetLang}::${text}`;
  if (translationCache[key]) return translationCache[key];
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Translate the following text to English. Return ONLY the translated text, nothing else:\n\n${text}`
        }]
      })
    });
    const data = await res.json();
    const translated = data?.content?.[0]?.text?.trim() || text;
    translationCache[key] = translated;
    return translated;
  } catch {
    return text;
  }
}

async function translateMessage(msg, lang) {
  if (lang === "pt") return msg;
  const [title, content] = await Promise.all([
    translateText(msg.title, lang),
    translateText(msg.content, lang),
  ]);
  return { ...msg, title, content };
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
  appName: "IE & Liderança",
  appSubtitle: "Inteligência Emocional & Soft Skills",
  appIcon: "🧠",
  footerText: "Inteligência Emocional & Liderança",
  colorPrimary: "#1E3A5F",
  colorSecondary: "#2E6DA4",
  bgColor: "#F0F4F8",
  showFooter: true,
  showSubtitle: true,
  gridCols: 2,
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
  pt: {
    home: "Início", author: "Autor",
    all: "Todas", loading: "⏳ Carregando...", noMessages: "Nenhuma mensagem ainda.",
    reflect: "💭 Reflita sobre isso",
    reflectSub: "Como você pode aplicar essa ideia no seu dia a dia?",
    back: "← Voltar", about: "Sobre", mission: "Missão",
  },
  en: {
    home: "Home", author: "Author",
    all: "All", loading: "⏳ Loading...", noMessages: "No messages yet.",
    reflect: "💭 Reflect on this",
    reflectSub: "How can you apply this idea in your daily life?",
    back: "← Back", about: "About", mission: "Mission",
  }
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
  const [translating, setTranslating] = useState(false);
  const [translatedAuthor, setTranslatedAuthor] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setTranslatedMessages(msgs);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "config", "author"), (d) => {
      if (d.exists()) setAuthor({ ...defaultAuthor, ...d.data() });
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "config", "appearance"), (d) => {
      if (d.exists()) setAppearance({ ...defaultAppearance, ...d.data() });
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "config", "categories"), (d) => {
      if (d.exists() && d.data().list) setCategories(d.data().list);
    });
  }, []);

  const switchLang = useCallback(async (newLang) => {
    if (newLang === lang) return;
    setLang(newLang);
    if (newLang === "pt") {
      setTranslatedMessages(messages);
      setTranslatedAuthor(null);
      return;
    }
    setTranslating(true);
    try {
      const [tMsgs, tTitle, tBio, tMission, tStat1, tStat2, tStat3] = await Promise.all([
        Promise.all(messages.map(m => translateMessage(m, newLang))),
        translateText(author.title, newLang),
        translateText(author.bio, newLang),
        translateText(author.mission, newLang),
        translateText(author.stat1Label, newLang),
        translateText(author.stat2Label, newLang),
        translateText(author.stat3Label, newLang),
      ]);
      setTranslatedMessages(tMsgs);
      setTranslatedAuthor({
        ...author,
        title: tTitle, bio: tBio, mission: tMission,
        stat1Label: tStat1, stat2Label: tStat2, stat3Label: tStat3,
      });
    } finally {
      setTranslating(false);
    }
  }, [lang, messages, author]);

  const displayMessages = lang === "pt" ? messages : translatedMessages;
  const displayAuthor = lang === "pt" ? author : (translatedAuthor || author);
  const t = ui[lang];
  const activeCats = categories.filter(c => c.active !== false);
  const getCat = (id) => categories.find(c => c.id === id) || { label: id, color: "#999" };
  const grad = `linear-gradient(135deg, ${appearance.colorPrimary}, ${appearance.colorSecondary})`;

  const LangSwitcher = () => (
    <div style={s.langSwitcher}>
      <button onClick={() => switchLang("pt")}
        style={{ ...s.langBtn, opacity: lang === "pt" ? 1 : 0.45, transform: lang === "pt" ? "scale(1.15)" : "scale(1)" }}>
        🇧🇷
      </button>
      <button onClick={() => switchLang("en")}
        style={{ ...s.langBtn, opacity: lang === "en" ? 1 : 0.45, transform: lang === "en" ? "scale(1.15)" : "scale(1)" }}>
        🇺🇸
      </button>
      {translating && <span style={s.translatingDot}>⟳</span>}
    </div>
  );

  return (
    <div style={{ ...s.root, background: appearance.bgColor }}>
      <div style={s.screen}>
        {screen === "home" && (
          <HomeScreen messages={displayMessages} loading={loading || translating}
            activeTab={activeTab} setActiveTab={setActiveTab}
            setScreen={setScreen} setSelectedMessage={setSelectedMessage}
            appearance={appearance} grad={grad} activeCats={activeCats}
            getCat={getCat} t={t} LangSwitcher={LangSwitcher} />
        )}
        {screen === "author" && (
          <AuthorScreen author={displayAuthor} grad={grad} appearance={appearance}
            t={t} LangSwitcher={LangSwitcher} />
        )}
        {screen === "detail" && selectedMessage && (
          <DetailScreen message={selectedMessage} setScreen={setScreen}
            appearance={appearance} grad={grad} getCat={getCat} t={t}
            displayMessages={displayMessages} />
        )}
      </div>
      <div style={s.tabBar}>
        {[
          { id: "home", icon: appearance.appIcon || "🧠", label: t.home },
          { id: "author", icon: "👤", label: t.author },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setScreen(tab.id)}
            style={{ ...s.tabButton, color: screen === tab.id ? appearance.colorPrimary : "#9CA3AF" }}>
            <span style={s.tabIcon}>{tab.icon}</span>
            <span style={s.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeScreen({ messages, loading, activeTab, setActiveTab, setScreen, setSelectedMessage, appearance, grad, activeCats, getCat, t, LangSwitcher }) {
  const filtered = activeTab === "todas" ? messages : messages.filter(m => m.category === activeTab);
  const cols = appearance.gridCols || 2;

  return (
    <div style={s.page}>
      <div style={s.homeHeader}>
        <div>
          <div style={{ ...s.appBadge, background: grad }}>
            <span style={{ fontSize: 18 }}>{appearance.appIcon || "🧠"}</span>
            <span style={s.appBadgeText}>{appearance.appName || "IE & Liderança"}</span>
          </div>
          {appearance.showSubtitle !== false && (
            <p style={s.homeSubtitle}>{appearance.appSubtitle}</p>
          )}
        </div>
        <LangSwitcher />
      </div>

      <div style={s.categoryScroll}>
        {[{ id: "todas", label: t.all }, ...activeCats].map(cat => (
          <button key={cat.id} onClick={() => setActiveTab(cat.id)}
            style={{ ...s.categoryChip, background: activeTab === cat.id ? appearance.colorPrimary : "#F3F4F6", color: activeTab === cat.id ? "#fff" : "#6B7280" }}>
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.emptyBox}><p style={s.loadingText}>{t.loading}</p></div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyBox}><p style={s.emptyText}>{t.noMessages}</p></div>
      ) : (
        <div style={{ ...s.messageGrid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {filtered.map(msg => {
            const cat = getCat(msg.category);
            return (
              <button key={msg.id} style={s.messageCard}
                onClick={() => { setSelectedMessage(msg); setScreen("detail"); }}>
                <div style={{ ...s.cardIconBg, background: (cat.color || msg.color) + "22" }}>
                  <span style={s.cardIcon}>{msg.icon}</span>
                </div>
                <p style={s.cardTitle}>{msg.title}</p>
                <span style={{ ...s.cardBadge, background: (cat.color || msg.color) + "22", color: cat.color || msg.color }}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {appearance.showFooter !== false && (
        <p style={s.footerNote}>{appearance.footerText}</p>
      )}
    </div>
  );
}

function DetailScreen({ message, setScreen, appearance, grad, getCat, t, displayMessages }) {
  const displayed = displayMessages?.find(m => m.id === message.id) || message;
  const cat = getCat(message.category);
  return (
    <div style={s.page}>
      <div style={s.detailHeader}>
        <button onClick={() => setScreen("home")} style={{ ...s.backButton, color: appearance.colorPrimary }}>{t.back}</button>
      </div>
      <div style={s.detailHero}>
        <div style={{ ...s.detailIconBg, background: (cat.color || message.color) + "22" }}>
          <span style={s.detailIcon}>{message.icon}</span>
        </div>
        <span style={{ ...s.detailBadge, background: (cat.color || message.color) + "22", color: cat.color || message.color }}>
          {cat.label}
        </span>
      </div>
      <h1 style={s.detailTitle}>{displayed.title}</h1>
      <div style={s.detailCard}>
        <div style={{ width: 4, background: cat.color || message.color, borderRadius: 4, marginRight: 16, flexShrink: 0 }} />
        <p style={s.detailContent}>{displayed.content}</p>
      </div>
      <div style={{ ...s.reflectBox, background: `linear-gradient(135deg, ${appearance.colorPrimary}18, ${appearance.colorSecondary}18)` }}>
        <p style={{ ...s.reflectTitle, color: appearance.colorPrimary }}>{t.reflect}</p>
        <p style={s.reflectText}>{t.reflectSub}</p>
      </div>
    </div>
  );
}

function AuthorScreen({ author, grad, appearance, t, LangSwitcher }) {
  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <LangSwitcher />
      </div>
      <div style={s.authorHero}>
        <div style={{ ...s.authorAvatarBg, boxShadow: `0 8px 24px ${appearance.colorPrimary}33` }}>
          <span style={s.authorAvatar}>{author.avatar}</span>
        </div>
      </div>
      <div style={s.authorInfo}>
        <h1 style={s.authorName}>{author.name}</h1>
        <p style={{ ...s.authorTitle, color: appearance.colorPrimary }}>{author.title}</p>
      </div>
      <div style={s.statsRow}>
        {[
          { label: author.stat1Label, value: author.stat1Value },
          { label: author.stat2Label, value: author.stat2Value },
          { label: author.stat3Label, value: author.stat3Value },
        ].map(st => (
          <div key={st.label} style={s.statBox}>
            <p style={{ ...s.statValue, color: appearance.colorPrimary }}>{st.value}</p>
            <p style={s.statLabel}>{st.label}</p>
          </div>
        ))}
      </div>
      <div style={s.bioCard}>
        <p style={s.bioTitle}>{t.about}</p>
        <p style={s.bioText}>{author.bio}</p>
      </div>
      <div style={{ ...s.missionCard, background: grad }}>
        <span style={{ fontSize: 28, marginBottom: 8, display: "block" }}>✨</span>
        <p style={s.missionTitle}>{t.mission}</p>
        <p style={s.missionText}>"{author.mission}"</p>
      </div>
    </div>
  );
}

const s = {
  root: { display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 430, margin: "0 auto", overflowX: "hidden" },
  screen: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  tabBar: { height: 80, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" },
  tabButton: { display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 3, padding: "0 40px" },
  tabIcon: { fontSize: 26 },
  tabLabel: { fontSize: 11, fontWeight: 600 },
  page: { padding: "20px 20px 32px" },
  homeHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  appBadge: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 20, padding: "6px 14px", marginBottom: 6 },
  appBadgeText: { color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: -0.5 },
  homeSubtitle: { color: "#6B7280", fontSize: 13, margin: 0 },
  langSwitcher: { display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "4px 8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  langBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "2px 4px", borderRadius: 8, transition: "all 0.2s" },
  translatingDot: { fontSize: 14, color: "#6B7280" },
  categoryScroll: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4, scrollbarWidth: "none" },
  categoryChip: { padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  emptyBox: { textAlign: "center", padding: "60px 20px" },
  loadingText: { color: "#6B7280", fontSize: 15, margin: 0 },
  emptyText: { color: "#374151", fontSize: 16, fontWeight: 700, margin: 0 },
  messageGrid: { display: "grid", gap: 14 },
  messageCard: { background: "#fff", borderRadius: 20, padding: 16, border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 },
  cardIconBg: { width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  cardIcon: { fontSize: 30 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#111", margin: 0, lineHeight: 1.3 },
  cardBadge: { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 },
  detailHeader: { marginBottom: 24 },
  backButton: { background: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer", padding: "8px 16px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  detailHero: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 },
  detailIconBg: { width: 100, height: 100, borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  detailIcon: { fontSize: 52 },
  detailBadge: { fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 },
  detailTitle: { fontSize: 24, fontWeight: 800, color: "#111", textAlign: "center", margin: "0 0 20px", lineHeight: 1.25 },
  detailCard: { background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16, display: "flex", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  detailContent: { fontSize: 16, lineHeight: 1.7, color: "#374151", margin: 0 },
  reflectBox: { borderRadius: 20, padding: 20 },
  reflectTitle: { fontWeight: 700, fontSize: 15, margin: "0 0 8px" },
  reflectText: { fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: 0 },
  authorHero: { display: "flex", justifyContent: "center", marginBottom: 20 },
  authorAvatarBg: { width: 100, height: 100, borderRadius: 50, background: "linear-gradient(135deg, #DBEAFE, #EFF6FF)", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff" },
  authorAvatar: { fontSize: 52 },
  authorInfo: { textAlign: "center", marginBottom: 24 },
  authorName: { fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 6px" },
  authorTitle: { fontWeight: 600, fontSize: 14, margin: 0 },
  statsRow: { display: "flex", gap: 12, marginBottom: 20 },
  statBox: { flex: 1, background: "#fff", borderRadius: 16, padding: "14px 10px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  statValue: { fontSize: 22, fontWeight: 800, margin: "0 0 4px" },
  statLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: 600, margin: 0 },
  bioCard: { background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  bioTitle: { fontWeight: 700, fontSize: 16, color: "#111", margin: "0 0 10px" },
  bioText: { fontSize: 14, color: "#6B7280", lineHeight: 1.7, margin: 0 },
  missionCard: { borderRadius: 20, padding: 20, textAlign: "center" },
  missionTitle: { fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.8)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 },
  missionText: { fontSize: 14, color: "#fff", lineHeight: 1.7, margin: 0, fontStyle: "italic" },
  footerNote: { textAlign: "center", fontSize: 10, color: "#B0B8C4", marginTop: 24, marginBottom: 0, letterSpacing: 0.3, fontStyle: "italic" },
};
