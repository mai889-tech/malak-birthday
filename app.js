(() => {
  const $ = (id) => document.getElementById(id);
  const dialog = $("adminDialog");
  const cfg = window.SITE_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_") && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  let supabase = null;
  let currentUser = null;
  const BUCKET = "malak-photos";
  const TABLE = "memories";

  // A quiet, original ambient melody generated locally with Web Audio.
  // It starts only after a deliberate tap/click, respecting browser autoplay rules.
  const musicButton = $("musicToggle");
  const musicLabel = $("musicLabel");
  const musicHint = $("musicHint");
  let audioContext = null;
  let musicMaster = null;
  let musicTimer = null;
  let musicStep = 0;
  let hintTimer = null;
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392.00,
                  440.00, 523.25, 659.25, 523.25, 493.88, 440.00, 392.00, 440.00];

  function showMusicHint(message) {
    if (!musicHint) return;
    musicHint.textContent = message;
    musicHint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => musicHint.classList.remove("show"), 3400);
  }
  function playSoftNote(frequency, startAt, duration, volume) {
    if (!audioContext || !musicMaster) return;
    const osc = audioContext.createOscillator();
    const tone = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, startAt);
    tone.gain.setValueAtTime(0.0001, startAt);
    tone.gain.exponentialRampToValueAtTime(volume, startAt + 0.18);
    tone.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(tone);
    tone.connect(musicMaster);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.04);
  }
  function playMusicPhrase() {
    if (!audioContext || !musicMaster) return;
    const now = audioContext.currentTime + 0.08;
    const freq = melody[musicStep % melody.length];
    playSoftNote(freq, now, 1.8, 0.11);
    // A very quiet lower note adds warmth without making the page busy.
    if (musicStep % 2 === 0) playSoftNote(freq / 2, now + 0.05, 2.2, 0.035);
    musicStep++;
  }
  async function startMusic() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      showMusicHint("المتصفح ده مش بيدعم تشغيل الموسيقى هنا.");
      return;
    }
    try {
      if (!audioContext) {
        audioContext = new AudioContextClass();
        musicMaster = audioContext.createGain();
        musicMaster.gain.value = 0.22;
        musicMaster.connect(audioContext.destination);
      }
      await audioContext.resume();
      playMusicPhrase();
      musicTimer = setInterval(playMusicPhrase, 2100);
      musicButton?.setAttribute("aria-pressed", "true");
      musicButton?.setAttribute("aria-label", "إيقاف الموسيقى");
      if (musicLabel) musicLabel.textContent = "إيقاف الموسيقى";
      showMusicHint("الموسيقى شغّالة بهدوء ♫");
    } catch (error) {
      console.warn("Audio could not start", error);
      showMusicHint("جرّب تضغط على زر الموسيقى مرة تانية.");
    }
  }
  async function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
    if (audioContext && audioContext.state !== "closed") await audioContext.suspend();
    musicButton?.setAttribute("aria-pressed", "false");
    musicButton?.setAttribute("aria-label", "تشغيل الموسيقى");
    if (musicLabel) musicLabel.textContent = "شغّل الموسيقى";
    showMusicHint("تم إيقاف الموسيقى.");
  }
  musicButton?.addEventListener("click", () => {
    if (musicTimer) stopMusic();
    else startMusic();
  });

  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }
  function safeText(s) { return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function showPanel() {
    $("loginPanel").hidden = !!currentUser;
    $("managePanel").hidden = !currentUser;
    $("configWarning").hidden = configured;
  }
  $("adminOpen").addEventListener("click", () => { showPanel(); dialog.showModal(); });
  $("closeAdmin").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

  async function loadMemories() {
    const gallery = $("gallery");
    if (!configured || !supabase) return;
    const { data, error } = await supabase.from(TABLE).select("id,title,caption,photo_path,created_at").order("created_at", {ascending:false});
    if (error) { console.error(error); return; }
    if (!data || !data.length) {
      gallery.innerHTML = '<div class="empty-gallery"><div class="empty-icon">✳</div><h3>المكان ده مستني ذكرياتك</h3><p>الصور اللي هتتضاف هتظهر هنا.</p></div>';
      $("adminList").innerHTML = ""; return;
    }
    gallery.innerHTML = "";
    $("adminList").innerHTML = "";
    for (const item of data) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(item.photo_path);
      const card = document.createElement("article");
      card.className = "photo-card";
      card.innerHTML = `<img loading="lazy" src="${urlData.publicUrl}" alt="${safeText(item.title)}"><div class="photo-meta"><h3>${safeText(item.title || "ذكرى")}</h3><p>${safeText(item.caption)}</p></div>`;
      gallery.appendChild(card);
      const row = document.createElement("div");
      row.className = "admin-item";
      row.innerHTML = `<img src="${urlData.publicUrl}" alt=""><span>${safeText(item.title || "ذكرى")}</span><button type="button" data-id="${safeText(item.id)}" data-path="${safeText(item.photo_path)}">حذف</button>`;
      row.querySelector("button").addEventListener("click", () => deleteMemory(item));
      $("adminList").appendChild(row);
    }
  }
  async function deleteMemory(item) {
    if (!currentUser || !confirm("متأكد إنك عايز تحذف الصورة دي؟")) return;
    $("adminStatus").textContent = "جاري الحذف...";
    const { error: rowError } = await supabase.from(TABLE).delete().eq("id", item.id);
    if (rowError) { $("adminStatus").textContent = "الحذف ما تمش. راجع إعدادات قاعدة البيانات."; return; }
    await supabase.storage.from(BUCKET).remove([item.photo_path]);
    $("adminStatus").textContent = "تم حذف الصورة.";
    await loadMemories();
  }

  $("loginBtn").addEventListener("click", async () => {
    if (!configured) { $("configWarning").hidden = false; return; }
    const email = $("email").value.trim(), password = $("password").value;
    if (!email || !password) { toast("اكتب البريد الإلكتروني وكلمة المرور."); return; }
    const { data, error } = await supabase.auth.signInWithPassword({email, password});
    if (error) { toast("تعذر تسجيل الدخول. راجع البيانات."); return; }
    currentUser = data.user; showPanel(); await loadMemories();
  });
  $("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut(); currentUser = null; showPanel(); toast("تم تسجيل الخروج.");
  });
  $("uploadBtn").addEventListener("click", async () => {
    if (!currentUser) return;
    const file = $("photoFile").files[0];
    if (!file) { toast("اختار صورة الأول."); return; }
    if (!file.type.startsWith("image/")) { toast("اختار ملف صورة."); return; }
    if (file.size > 8 * 1024 * 1024) { toast("حجم الصورة لازم يكون أقل من 8 ميجابايت."); return; }
    const title = $("photoTitle").value.trim() || "ذكرى جميلة";
    const caption = $("photoCaption").value.trim();
    const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    $("adminStatus").textContent = "جاري رفع الصورة...";
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {cacheControl:"3600", upsert:false, contentType:file.type});
    if (uploadError) { $("adminStatus").textContent = "فشل رفع الصورة. راجع إعدادات التخزين والصلاحيات في README."; return; }
    const { error: rowError } = await supabase.from(TABLE).insert({title, caption, photo_path:path, owner_id:currentUser.id});
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      $("adminStatus").textContent = "الصورة لم تُحفظ في المعرض. راجع إعدادات قاعدة البيانات."; return;
    }
    $("photoFile").value = ""; $("photoTitle").value = ""; $("photoCaption").value = "";
    $("adminStatus").textContent = "اتضافت الصورة بنجاح.";
    await loadMemories();
  });

  if (configured && window.supabase) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    supabase.auth.getSession().then(({data}) => { currentUser = data.session?.user || null; showPanel(); });
    supabase.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; showPanel(); });
    loadMemories();
  } else {
    showPanel();
  }
})();