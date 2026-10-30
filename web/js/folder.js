// Klasörden yükleme (sunucusuz, yalnız tarayıcı).
// File System Access API varsa (Chrome, Edge) seçilen klasör hatırlanır; sonraki açılışta tek tıkla ("Klasörü oku") yeniden okunur.
// Yoksa (Brave, Safari, Firefox) <input webkitdirectory> ile klasör her açılışta seçilir.
// Tarayıcı güvenliği gereği file:// sayfası bir klasörü kendiliğinden okuyamaz; en az bir tıklama gerekir.
(function (SD) {
  const DB = 'sd-klasor', STORE = 'h', KEY = 'dir';

  // Yalnız scraper çıktıları: <site>[-ek]-siparisler*.json (Amazon sayfa dosyaları, başka hesap ör. trendyol-hesap2 dahil).
  // Aynı sitenin dosyaları panelde tek mağazada birleşir.
  const wanted = name => /\.json$/i.test(name) &&
    Object.keys(SD.adapters).some(s => new RegExp(`^${s}(-[\\w]+)?-siparisler`, 'i').test(name));
  // Örnek dosyalar (*.example.json) yalnız klasörde gerçek dosya yoksa kullanılır (ör. examples/ klasörü seçilince)
  const onlyReal = files => {
    const real = files.filter(f => !/\.example\.json$/i.test(f.name));
    return real.length ? real : files;
  };

  // --- IndexedDB: klasör tutamacını sakla ---
  function idb(mode, fn) {
    return new Promise((res, rej) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => res(req?.result);
        tx.onerror = () => rej(tx.error);
      };
    });
  }
  const saveHandle = h => idb('readwrite', s => s.put(h, KEY));
  const loadHandle = () => idb('readonly', s => s.get(KEY)).catch(() => null);

  async function readHandle(dir) {
    const files = [];
    for await (const [name, entry] of dir.entries())
      if (entry.kind === 'file' && wanted(name)) files.push(await entry.getFile());
    return onlyReal(files);
  }

  // Kayıtlı klasör: izin hâlâ varsa dosyalar, yoksa { needsPermission, name }
  async function fromSaved() {
    if (!window.showDirectoryPicker) return null;
    const dir = await loadHandle();
    if (!dir) return null;
    const p = await dir.queryPermission({ mode: 'read' });
    return p === 'granted' ? { name: dir.name, files: await readHandle(dir) } : { name: dir.name, needsPermission: true };
  }

  // Kullanıcı tıklamasıyla çağrılmalı (izin istemi buna bağlı)
  async function reconnect() {
    const dir = await loadHandle();
    if (!dir || (await dir.requestPermission({ mode: 'read' })) !== 'granted') return null;
    return { name: dir.name, files: await readHandle(dir) };
  }

  async function pick() {
    if (window.showDirectoryPicker) {
      const dir = await window.showDirectoryPicker({ id: 'siparisler', mode: 'read' });
      await saveHandle(dir).catch(() => {});
      return { name: dir.name, files: await readHandle(dir), remembered: true };
    }
    return new Promise(res => {
      const input = Object.assign(document.createElement('input'), { type: 'file', webkitdirectory: true, multiple: true });
      input.addEventListener('change', () => {
        const all = [...input.files];
        const name = all[0]?.webkitRelativePath.split('/')[0] || 'klasör';
        // Yalnız klasörün kendisindeki dosyalar (alt klasörler değil)
        res({ name, files: onlyReal(all.filter(f => f.webkitRelativePath.split('/').length === 2 && wanted(f.name))) });
      });
      input.addEventListener('cancel', () => res(null));
      input.click();
    });
  }

  SD.folder = { fromSaved, reconnect, pick };
})(window.SD);
