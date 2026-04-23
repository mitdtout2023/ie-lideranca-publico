import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";

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
const ADMIN_PASSWORD = "1234";

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
          content: `Translate the following text to English. Return ONLY the translated text, nothing else, no explanations:\n\n${text}`
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

const avatarOptions = ["👩‍💼","👨‍💼","👩‍🏫","👨‍🏫","👩‍⚕️","👨‍⚕️","🧑‍💻","👩‍🎓","👨‍🎓","🧑‍🏫"];
const iconOptions = ["💡","🎯","🧠","❤️","🤝","🔥","🌈","⭐","🏆","🌺"];
const appIconOptions = ["🧠","💡","❤️","🌟","🎯","🔥","🤝","🌱","⚡","🏆"];

const ui = {
  pt: {
    home: "Início", author: "Autor", admin: "Admin",
    all: "Todas", loading: "⏳ Carregando...", noMessages: "Nenhuma mensagem ainda.",
    addFirst: "Toque em + para adicionar!", newMessage: "Nova Mensagem",
    editMessage: "✏️ Editar Mensagem", title: "Título", content: "Conteúdo...",
    save: "Salvar Mensagem", saveEdit: "Salvar Alterações",
    reflect: "💭 Reflita sobre isso", reflectSub: "Como você pode aplicar essa ideia no seu dia a dia?",
    back: "← Voltar", about: "Sobre", mission: "Missão",
    adminTitle: "⚙️ Painel Admin", adminSub: "Edite o conteúdo do app", logout: "Sair",
    password: "Área Administrativa", passwordSub: "Digite a senha para continuar",
    enter: "Entrar", wrongPassword: "Senha incorreta.",
    categories: "🏷️ Categorias", appearance: "🎨 Aparência", messages: "💬 Mensagens",
    years: "Anos de Experiência",
  },
  en: {
    home: "Home", author: "Author", admin: "Admin",
    all: "All", loading: "⏳ Loading...", noMessages: "No messages yet.",
    addFirst: "Tap + to add!", newMessage: "New Message",
    editMessage: "✏️ Edit Message", title: "Title", content: "Content...",
    save: "Save Message", saveEdit: "Save Changes",
    reflect: "💭 Reflect on this", reflectSub: "How can you apply this idea in your daily life?",
    back: "← Back", about: "About", mission: "Mission",
    adminTitle: "⚙️ Admin Panel", adminSub: "Edit app content", logout: "Logout",
    password: "Admin Area", passwordSub: "Enter password to continue",
    enter: "Enter", wrongPassword: "Incorrect password.",
    categories: "🏷️ Categories", appearance: "🎨 Appearance", messages: "💬 Messages",
    years: "Years of Experience",
  }
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMsg, setNewMsg] = useState({ title: "", content: "", category: "autoconhecimento", icon: "💡" });
  const [activeTab, setActiveTab] = useState("todas");
  const [isAdmin, setIsAdmin] = useState(false);
  const [author, setAuthor] = useState(defaultAuthor);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [categories, setCategories] = useState(defaultCategories);
  const [editingMessage, setEditingMessage] = useState(null);
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

  const handleAddMessage = async () => {
    if (!newMsg.title || !newMsg.content) return;
    const cat = getCat(newMsg.category);
    if (editingMessage) {
      await updateDoc(doc(db, "messages", editingMessage.id), { ...newMsg, color: cat.color });
      setEditingMessage(null);
    } else {
      await addDoc(collection(db, "messages"), { ...newMsg, color: cat.color, createdAt: Date.now() });
    }
    setNewMsg({ title: "", content: "", category: activeCats[0]?.id || "autoconhecimento", icon: "💡" });
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "messages", id));
    setSelectedMessage(null);
    setScreen("home");
  };

  const handleEditMessage = (msg) => {
    setEditingMessage(msg);
    setNewMsg({ title: msg.title, content: msg.content, category: msg.category, icon: msg.icon });
    setShowAddForm(true);
    setScreen("home");
  };

  const grad = `linear-gradient(135deg, ${appearance.colorPrimary}, ${appearance.colorSecondary})`;

  // Language switcher widget
  const LangSwitcher = () => (
    <div style={s.langSwitcher}>
      <button onClick={() => switchLang("pt")} style={{ ...s.langBtn, opacity: lang === "pt" ? 1 : 0.45, transform: lang === "pt" ? "scale(1.15)" : "scale(1)" }} title="Português">
        🇧🇷
      </button>
      <button onClick={() => switchLang("en")} style={{ ...s.langBtn, opacity: lang === "en" ? 1 : 0.45, transform: lang === "en" ? "scale(1.15)" : "scale(1)" }} title="English">
        🇺🇸
      </button>
      {translating && <span style={s.translatingDot}>⟳</span>}
    </div>
  );

  return (
    <div style={{ ...s.root, background: appearance.bgColor }}>
      <div style={s.screen}>
        {screen === "home" && (
          <HomeScreen messages={displayMessages} loading={loading} activeTab={activeTab}
            setActiveTab={setActiveTab} setScreen={setScreen} setSelectedMessage={setSelectedMessage}
            showAddForm={showAddForm} setShowAddForm={setShowAddForm}
            newMsg={newMsg} setNewMsg={setNewMsg} handleAddMessage={handleAddMessage}
            editingMessage={editingMessage} setEditingMessage={setEditingMessage}
            appearance={appearance} grad={grad} activeCats={activeCats} getCat={getCat}
            t={t} LangSwitcher={LangSwitcher} translating={translating} />
        )}
        {screen === "author" && <AuthorScreen author={displayAuthor} grad={grad} appearance={appearance} t={t} LangSwitcher={LangSwitcher} />}
        {screen === "detail" && selectedMessage && (
          <DetailScreen message={selectedMessage} setScreen={setScreen}
            handleDelete={handleDelete} handleEditMessage={handleEditMessage}
            isAdmin={isAdmin} appearance={appearance} grad={grad} getCat={getCat} t={t}
            displayMessages={displayMessages} />
        )}
        {screen === "admin" && (
          <AdminScreen isAdmin={isAdmin} setIsAdmin={setIsAdmin}
            author={author} appearance={appearance} categories={categories}
            messages={messages} handleDelete={handleDelete} handleEditMessage={handleEditMessage}
            grad={grad} activeCats={activeCats} getCat={getCat} t={t} />
        )}
      </div>
      <div style={s.tabBar}>
        {[
          { id: "home", icon: appearance.appIcon || "🧠", label: t.home },
          { id: "author", icon: "👤", label: t.author },
          { id: "admin", icon: "⚙️", label: t.admin },
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

function HomeScreen({ messages, loading, activeTab, setActiveTab, setScreen, setSelectedMessage, showAddForm, setShowAddForm, newMsg, setNewMsg, handleAddMessage, editingMessage, setEditingMessage, appearance, grad, activeCats, getCat, t, LangSwitcher, translating }) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LangSwitcher />
          <button onClick={() => { setShowAddForm(!showAddForm); setEditingMessage(null); setNewMsg({ title: "", content: "", category: activeCats[0]?.id || "autoconhecimento", icon: "💡" }); }}
            style={{ ...s.addButton, background: grad }}>
            {showAddForm ? "✕" : "+"}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div style={s.addForm}>
          <p style={s.formTitle}>{editingMessage ? t.editMessage : t.newMessage}</p>
          <input style={s.formInput} placeholder={t.title} value={newMsg.title}
            onChange={(e) => setNewMsg({ ...newMsg, title: e.target.value })} />
          <textarea style={{ ...s.formInput, height: 80, resize: "none" }}
            placeholder={t.content} value={newMsg.content}
            onChange={(e) => setNewMsg({ ...newMsg, content: e.target.value })} />
          <select style={{ ...s.formInput, marginBottom: 10 }} value={newMsg.category}
            onChange={(e) => setNewMsg({ ...newMsg, category: e.target.value })}>
            {activeCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div style={s.iconPicker}>
            {iconOptions.map(icon => (
              <button key={icon} onClick={() => setNewMsg({ ...newMsg, icon })}
                style={{ ...s.iconOption, background: newMsg.icon === icon ? "#DBEAFE" : "transparent", borderColor: newMsg.icon === icon ? appearance.colorPrimary : "#E5E7EB" }}>
                {icon}
              </button>
            ))}
          </div>
          <button onClick={handleAddMessage} style={{ ...s.saveButton, background: grad }}>
            {editingMessage ? t.saveEdit : t.save}
          </button>
        </div>
      )}

      <div style={s.categoryScroll}>
        {[{ id: "todas", label: t.all }, ...activeCats].map(cat => (
          <button key={cat.id} onClick={() => setActiveTab(cat.id)}
            style={{ ...s.categoryChip, background: activeTab === cat.id ? appearance.colorPrimary : "#F3F4F6", color: activeTab === cat.id ? "#fff" : "#6B7280" }}>
            {cat.label}
          </button>
        ))}
      </div>

      {loading || translating ? (
        <div style={s.emptyBox}><p style={s.loadingText}>{loading ? t.loading : "⟳ Traduzindo..."}</p></div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={s.emptyText}>{t.noMessages}</p>
          <p style={s.emptySubText}>{t.addFirst}</p>
        </div>
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

function DetailScreen({ message, setScreen, handleDelete, handleEditMessage, isAdmin, appearance, grad, getCat, t, displayMessages }) {
  const displayed = displayMessages?.find(m => m.id === message.id) || message;
  const cat = getCat(message.category);
  return (
    <div style={s.page}>
      <div style={s.detailHeader}>
        <button onClick={() => setScreen("home")} style={{ ...s.backButton, color: appearance.colorPrimary }}>{t.back}</button>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleEditMessage(message)} style={s.editButton}>✏️</button>
            <button onClick={() => handleDelete(message.id)} style={s.deleteButton}>🗑</button>
          </div>
        )}
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

function AdminScreen({ isAdmin, setIsAdmin, author, appearance, categories, messages, handleDelete, handleEditMessage, grad, activeCats, getCat, t }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [adminTab, setAdminTab] = useState("categorias");
  const [editAuthor, setEditAuthor] = useState(author);
  const [editAppearance, setEditAppearance] = useState(appearance);
  const [editCats, setEditCats] = useState(categories);
  const [saved, setSaved] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState("#45B7D1");

  useEffect(() => { setEditAuthor(author); }, [author]);
  useEffect(() => { setEditAppearance(appearance); }, [appearance]);
  useEffect(() => { setEditCats(categories); }, [categories]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) { setIsAdmin(true); setError(""); }
    else setError(t.wrongPassword);
  };

  const saveData = async (type) => {
    if (type === "autor") await setDoc(doc(db, "config", "author"), editAuthor);
    if (type === "aparencia") await setDoc(doc(db, "config", "appearance"), editAppearance);
    if (type === "categorias") await setDoc(doc(db, "config", "categories"), { list: editCats });
    setSaved(type);
    setTimeout(() => setSaved(""), 2000);
  };

  const addCategory = () => {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setEditCats([...editCats, { id, label: newCatLabel.trim(), color: newCatColor, active: true }]);
    setNewCatLabel("");
  };

  const toggleCat = (id) => setEditCats(editCats.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const removeCat = (id) => setEditCats(editCats.filter(c => c.id !== id));
  const updateCatLabel = (id, label) => setEditCats(editCats.map(c => c.id === id ? { ...c, label } : c));
  const updateCatColor = (id, color) => setEditCats(editCats.map(c => c.id === id ? { ...c, color } : c));

  if (!isAdmin) {
    return (
      <div style={s.page}>
        <div style={s.adminLoginBox}>
          <span style={{ fontSize: 52, marginBottom: 16, display: "block", textAlign: "center" }}>🔐</span>
          <h2 style={s.adminLoginTitle}>{t.password}</h2>
          <p style={s.adminLoginSub}>{t.passwordSub}</p>
          <input style={{ ...s.formInput, textAlign: "center", fontSize: 24, letterSpacing: 8 }}
            type="password" placeholder="••••" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
          {error && <p style={s.errorText}>{error}</p>}
          <button onClick={handleLogin} style={{ ...s.saveButton, background: grad }}>{t.enter}</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "categorias", label: t.categories },
    { id: "aparencia", label: t.appearance },
    { id: "autor", label: "👤 Autor" },
    { id: "mensagens", label: t.messages },
  ];

  return (
    <div style={s.page}>
      <div style={s.adminHeader}>
        <div>
          <p style={s.adminHeaderTitle}>{t.adminTitle}</p>
          <p style={s.adminHeaderSub}>{t.adminSub}</p>
        </div>
        <button onClick={() => setIsAdmin(false)} style={s.logoutButton}>{t.logout}</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setAdminTab(tab.id)}
            style={{ ...s.categoryChip, background: adminTab === tab.id ? appearance.colorPrimary : "#F3F4F6", color: adminTab === tab.id ? "#fff" : "#6B7280", whiteSpace: "nowrap", fontSize: 12 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {adminTab === "categorias" && (
        <div style={s.addForm}>
          <p style={s.formTitle}>🏷️ Gerenciar Categorias</p>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>Renomeie, mude a cor, oculte ou remova categorias.</p>
          {editCats.map(cat => (
            <div key={cat.id} style={{ background: cat.active !== false ? "#F8FAFC" : "#FFF5F5", borderRadius: 14, padding: 12, marginBottom: 10, border: `1.5px solid ${cat.active !== false ? "#E5E7EB" : "#FECACA"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="color" value={cat.color} onChange={(e) => updateCatColor(cat.id, e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0 }} />
                <input style={{ ...s.formInput, flex: 1, marginBottom: 0, fontSize: 14 }} value={cat.label}
                  onChange={(e) => updateCatLabel(cat.id, e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleCat(cat.id)}
                  style={{ ...s.categoryChip, flex: 1, fontSize: 12, padding: "6px 10px", background: cat.active !== false ? "#DCFCE7" : "#FEE2E2", color: cat.active !== false ? "#16a34a" : "#DC2626" }}>
                  {cat.active !== false ? "✅ Visível" : "🚫 Oculta"}
                </button>
                <button onClick={() => removeCat(cat.id)} style={{ ...s.deleteButton, padding: "6px 14px", fontSize: 13 }}>🗑 Remover</button>
              </div>
            </div>
          ))}
          <div style={{ background: "#F0F9FF", borderRadius: 14, padding: 12, marginTop: 8, border: "1.5px dashed #BAE6FD" }}>
            <p style={{ ...s.fieldLabel, marginBottom: 8 }}>+ Nova Categoria</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)}
                style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0 }} />
              <input style={{ ...s.formInput, flex: 1, marginBottom: 0 }} placeholder="Nome da categoria"
                value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} />
            </div>
            <button onClick={addCategory} style={{ ...s.saveButton, background: "#0EA5E9", fontSize: 14, padding: "10px" }}>Adicionar Categoria</button>
          </div>
          <button onClick={() => saveData("categorias")} style={{ ...s.saveButton, marginTop: 14, background: saved === "categorias" ? "#16a34a" : grad }}>
            {saved === "categorias" ? "✅ Salvo!" : "Salvar Categorias"}
          </button>
        </div>
      )}

      {adminTab === "aparencia" && (
        <div style={s.addForm}>
          <p style={s.formTitle}>🎨 Aparência da Tela Início</p>
          <p style={s.fieldLabel}>Ícone do App</p>
          <div style={{ ...s.iconPicker, marginBottom: 12 }}>
            {appIconOptions.map(ic => (
              <button key={ic} onClick={() => setEditAppearance({ ...editAppearance, appIcon: ic })}
                style={{ ...s.iconOption, fontSize: 24, background: editAppearance.appIcon === ic ? "#DBEAFE" : "transparent", borderColor: editAppearance.appIcon === ic ? appearance.colorPrimary : "#E5E7EB" }}>
                {ic}
              </button>
            ))}
          </div>
          <p style={s.fieldLabel}>Nome do App</p>
          <input style={s.formInput} value={editAppearance.appName} onChange={(e) => setEditAppearance({ ...editAppearance, appName: e.target.value })} />
          <p style={s.fieldLabel}>Subtítulo</p>
          <input style={s.formInput} value={editAppearance.appSubtitle} onChange={(e) => setEditAppearance({ ...editAppearance, appSubtitle: e.target.value })} />
          <p style={s.fieldLabel}>Texto do Rodapé</p>
          <input style={s.formInput} value={editAppearance.footerText} onChange={(e) => setEditAppearance({ ...editAppearance, footerText: e.target.value })} />
          <p style={s.fieldLabel}>Cor Principal</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <input type="color" value={editAppearance.colorPrimary} onChange={(e) => setEditAppearance({ ...editAppearance, colorPrimary: e.target.value })}
              style={{ width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer" }} />
            <input style={{ ...s.formInput, flex: 1, marginBottom: 0 }} value={editAppearance.colorPrimary} onChange={(e) => setEditAppearance({ ...editAppearance, colorPrimary: e.target.value })} />
          </div>
          <p style={s.fieldLabel}>Cor Secundária</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <input type="color" value={editAppearance.colorSecondary} onChange={(e) => setEditAppearance({ ...editAppearance, colorSecondary: e.target.value })}
              style={{ width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer" }} />
            <input style={{ ...s.formInput, flex: 1, marginBottom: 0 }} value={editAppearance.colorSecondary} onChange={(e) => setEditAppearance({ ...editAppearance, colorSecondary: e.target.value })} />
          </div>
          <p style={s.fieldLabel}>Cor de Fundo</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
            <input type="color" value={editAppearance.bgColor} onChange={(e) => setEditAppearance({ ...editAppearance, bgColor: e.target.value })}
              style={{ width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer" }} />
            <input style={{ ...s.formInput, flex: 1, marginBottom: 0 }} value={editAppearance.bgColor} onChange={(e) => setEditAppearance({ ...editAppearance, bgColor: e.target.value })} />
          </div>
          <p style={s.fieldLabel}>Colunas dos Cards</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => setEditAppearance({ ...editAppearance, gridCols: n })}
                style={{ ...s.categoryChip, flex: 1, background: editAppearance.gridCols === n ? appearance.colorPrimary : "#F3F4F6", color: editAppearance.gridCols === n ? "#fff" : "#6B7280" }}>
                {n} col{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <p style={s.fieldLabel}>Exibir</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[{ key: "showSubtitle", label: "Subtítulo" }, { key: "showFooter", label: "Rodapé" }].map(item => (
              <button key={item.key} onClick={() => setEditAppearance({ ...editAppearance, [item.key]: !editAppearance[item.key] })}
                style={{ ...s.categoryChip, flex: 1, background: editAppearance[item.key] !== false ? appearance.colorPrimary : "#F3F4F6", color: editAppearance[item.key] !== false ? "#fff" : "#6B7280" }}>
                {editAppearance[item.key] !== false ? "✅" : "⬜"} {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => saveData("aparencia")} style={{ ...s.saveButton, background: saved === "aparencia" ? "#16a34a" : grad }}>
            {saved === "aparencia" ? "✅ Salvo!" : "Salvar Aparência"}
          </button>
        </div>
      )}

      {adminTab === "autor" && (
        <div style={s.addForm}>
          <p style={s.formTitle}>👤 Editar Autor</p>
          <p style={s.fieldLabel}>Avatar</p>
          <div style={{ ...s.iconPicker, marginBottom: 12 }}>
            {avatarOptions.map(av => (
              <button key={av} onClick={() => setEditAuthor({ ...editAuthor, avatar: av })}
                style={{ ...s.iconOption, fontSize: 26, width: 48, height: 48, background: editAuthor.avatar === av ? "#DBEAFE" : "transparent", borderColor: editAuthor.avatar === av ? appearance.colorPrimary : "#E5E7EB" }}>
                {av}
              </button>
            ))}
          </div>
          <p style={s.fieldLabel}>Nome</p>
          <input style={s.formInput} value={editAuthor.name} onChange={(e) => setEditAuthor({ ...editAuthor, name: e.target.value })} />
          <p style={s.fieldLabel}>Título / Cargo</p>
          <input style={s.formInput} value={editAuthor.title} onChange={(e) => setEditAuthor({ ...editAuthor, title: e.target.value })} />
          <p style={s.fieldLabel}>Bio</p>
          <textarea style={{ ...s.formInput, height: 100, resize: "none" }} value={editAuthor.bio} onChange={(e) => setEditAuthor({ ...editAuthor, bio: e.target.value })} />
          <p style={s.fieldLabel}>Missão</p>
          <textarea style={{ ...s.formInput, height: 80, resize: "none" }} value={editAuthor.mission} onChange={(e) => setEditAuthor({ ...editAuthor, mission: e.target.value })} />
          <p style={s.fieldLabel}>Estatísticas</p>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={{ ...s.formInput, flex: 2, marginBottom: 0 }} placeholder="Label" value={editAuthor[`stat${n}Label`]} onChange={(e) => setEditAuthor({ ...editAuthor, [`stat${n}Label`]: e.target.value })} />
              <input style={{ ...s.formInput, flex: 1, marginBottom: 0 }} placeholder="Valor" value={editAuthor[`stat${n}Value`]} onChange={(e) => setEditAuthor({ ...editAuthor, [`stat${n}Value`]: e.target.value })} />
            </div>
          ))}
          <button onClick={() => saveData("autor")} style={{ ...s.saveButton, marginTop: 12, background: saved === "autor" ? "#16a34a" : grad }}>
            {saved === "autor" ? "✅ Salvo!" : "Salvar Autor"}
          </button>
        </div>
      )}

      {adminTab === "mensagens" && (
        <div>
          {messages.length === 0 ? (
            <div style={s.emptyBox}><p style={s.emptyText}>{t.noMessages}</p></div>
          ) : messages.map(msg => {
            const cat = getCat(msg.category);
            return (
              <div key={msg.id} style={s.adminMsgCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
                  <div style={{ ...s.cardIconBg, width: 44, height: 44, flexShrink: 0, background: (cat.color || msg.color) + "22" }}>
                    <span style={{ fontSize: 22 }}>{msg.icon}</span>
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ ...s.cardTitle, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.title}</p>
                    <span style={{ ...s.cardBadge, background: (cat.color || msg.color) + "22", color: cat.color || msg.color }}>{cat.label}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleEditMessage(msg)} style={s.editButton}>✏️</button>
                  <button onClick={() => handleDelete(msg.id)} style={s.deleteButton}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  root: { display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 430, margin: "0 auto", overflowX: "hidden" },
  screen: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  tabBar: { height: 80, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" },
  tabButton: { display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 3, padding: "0 20px" },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 11, fontWeight: 600 },
  page: { padding: "20px 20px 32px" },
  homeHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  appBadge: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 20, padding: "6px 14px", marginBottom: 6 },
  appBadgeText: { color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: -0.5 },
  homeSubtitle: { color: "#6B7280", fontSize: 13, margin: 0 },
  addButton: { width: 44, height: 44, borderRadius: 22, border: "none", color: "#fff", fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  langSwitcher: { display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "4px 8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  langBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "2px 4px", borderRadius: 8, transition: "all 0.2s" },
  translatingDot: { fontSize: 14, color: "#6B7280", animation: "spin 1s linear infinite" },
  addForm: { background: "#fff", borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" },
  formTitle: { fontWeight: 700, fontSize: 16, color: "#111", margin: "0 0 12px" },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: "#6B7280", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5 },
  formInput: { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 15, marginBottom: 10, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#FAFAFA" },
  iconPicker: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  iconOption: { width: 44, height: 44, borderRadius: 12, border: "1.5px solid", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" },
  saveButton: { width: "100%", padding: "13px", borderRadius: 14, border: "none", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" },
  categoryScroll: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4, scrollbarWidth: "none" },
  categoryChip: { padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  emptyBox: { textAlign: "center", padding: "40px 20px" },
  loadingText: { color: "#6B7280", fontSize: 15, margin: 0 },
  emptyText: { color: "#374151", fontSize: 16, fontWeight: 700, margin: "0 0 8px" },
  emptySubText: { color: "#9CA3AF", fontSize: 14, margin: 0 },
  messageGrid: { display: "grid", gap: 14 },
  messageCard: { background: "#fff", borderRadius: 20, padding: 16, border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 },
  cardIconBg: { width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  cardIcon: { fontSize: 30 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#111", margin: 0, lineHeight: 1.3 },
  cardBadge: { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  backButton: { background: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer", padding: "8px 16px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  editButton: { background: "#DBEAFE", border: "none", fontSize: 18, cursor: "pointer", padding: "8px 12px", borderRadius: 16 },
  deleteButton: { background: "#FEE2E2", border: "none", fontSize: 18, cursor: "pointer", padding: "8px 12px", borderRadius: 16 },
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
  adminLoginBox: { background: "#fff", borderRadius: 24, padding: 28, marginTop: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  adminLoginTitle: { fontSize: 22, fontWeight: 800, color: "#111", textAlign: "center", margin: "0 0 8px" },
  adminLoginSub: { fontSize: 14, color: "#6B7280", textAlign: "center", margin: "0 0 20px" },
  errorText: { color: "#DC2626", fontSize: 13, textAlign: "center", margin: "0 0 12px" },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  adminHeaderTitle: { fontWeight: 800, fontSize: 18, color: "#111", margin: 0 },
  adminHeaderSub: { fontSize: 13, color: "#6B7280", margin: 0 },
  logoutButton: { background: "#FEE2E2", border: "none", color: "#DC2626", fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 20, cursor: "pointer" },
  adminMsgCard: { background: "#fff", borderRadius: 16, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
};
