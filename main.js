const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  baseUrl: 'https://api.groq.com/openai/v1',
  keyEnc: ''
};

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) { fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)); }
function readKey(s) {
  if (!s.keyEnc || !safeStorage.isEncryptionAvailable()) return '';
  try { return safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64')); } catch { return ''; }
}

const SYSTEM_PROMPT = `Bạn là trợ lý học tập. Đầu vào là văn bản thô lấy từ một trang học tập hoặc câu hỏi người dùng nhập tay (có thể lẫn menu, quảng cáo, nút bấm).
Nhiệm vụ: nhận diện từng câu hỏi thật sự, giải và giải thích ngắn gọn. Không bịa thêm câu hỏi không có trong văn bản.
Chỉ trả về JSON hợp lệ, không thêm chữ nào khác, theo schema:
{"questions":[{"number":"1","type":"mcq|short|truefalse","question":"nội dung câu hỏi (rút gọn nếu quá dài)","options":{"A":"...","B":"..."},"answer":"...","explanation":"..."}]}
Quy tắc:
- type "mcq": "options" là object theo nhãn phương án (A, B, C, D...), "answer" là nhãn của phương án đúng (ví dụ "B").
- type "short": trả lời ngắn hoặc điền số; "answer" là chuỗi kết quả (số kèm đơn vị nếu có); bỏ "options".
- type "truefalse": "answer" là true hoặc false (kiểu boolean); bỏ "options".
- "explanation": tối đa 3 câu, cùng ngôn ngữ với câu hỏi.
- Nếu không có câu hỏi nào, trả {"questions":[]}.`;

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    if (!res.ok) {
      const detail = (data && (data.error?.message || data.message)) || text.slice(0, 200);
      if (res.status === 400 && /api key|API_KEY/i.test(detail)) throw new Error('API Key không hợp lệ. Hãy kiểm tra lại trong Cài đặt.');
      if (res.status === 401 || res.status === 403) throw new Error('API Key bị từ chối (' + res.status + '). Hãy kiểm tra Key và quyền truy cập model.');
      if (res.status === 429) throw new Error('Đã hết hạn mức miễn phí hoặc gửi quá nhanh (429). Hãy đợi một lúc rồi thử lại.');
      if (res.status === 404) throw new Error('Không tìm thấy model hoặc địa chỉ API (404). Kiểm tra tên model/Base URL.');
      throw new Error('AI trả về lỗi ' + res.status + ': ' + detail);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI phản hồi quá lâu (quá 90 giây). Hãy thử lại với ít câu hỏi hơn.');
    if (e instanceof TypeError) throw new Error('Không kết nối được tới AI. Kiểm tra mạng, tường lửa hoặc Base URL.');
    throw e;
  } finally { clearTimeout(timer); }
}

async function callAI(text) {
  const s = loadSettings();
  const key = readKey(s);
  if (!key) throw new Error('Chưa có API Key. Mở Cài đặt (biểu tượng bánh răng) để nhập Key.');
  const input = text.length > 30000 ? text.slice(0, 30000) : text;
  let raw = '';
  if (s.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`;
    const data = await postJson(url, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    });
    raw = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!raw) throw new Error('AI không trả về nội dung (có thể bị chặn bộ lọc). Hãy thử lại.');
  } else {
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const data = await postJson(url, { Authorization: 'Bearer ' + key }, {
      model: s.model, temperature: 0.2,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: input }]
    });
    raw = data?.choices?.[0]?.message?.content || '';
    if (!raw) throw new Error('AI không trả về nội dung. Hãy thử lại.');
  }
  return parseQuestions(raw);
}

function parseQuestions(raw) {
  let t = raw.replace(/```json|```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('AI trả về dữ liệu không đọc được. Hãy thử lại.');
  let obj;
  try { obj = JSON.parse(t.slice(a, b + 1)); } catch { throw new Error('AI trả về JSON lỗi. Hãy thử lại.'); }
  return Array.isArray(obj.questions) ? obj.questions : [];
}

ipcMain.handle('settings:get', () => {
  const s = loadSettings();
  return { provider: s.provider, model: s.model, baseUrl: s.baseUrl, hasKey: !!readKey(s) };
});
ipcMain.handle('settings:save', (_e, p) => {
  const s = loadSettings();
  s.provider = p.provider === 'openai' ? 'openai' : 'gemini';
  s.model = String(p.model || DEFAULTS.model).trim();
  s.baseUrl = String(p.baseUrl || DEFAULTS.baseUrl).trim();
  if (p.clearKey) s.keyEnc = '';
  else if (p.apiKey) {
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Windows không hỗ trợ mã hóa Key trên máy này.' };
    s.keyEnc = safeStorage.encryptString(String(p.apiKey).trim()).toString('base64');
  }
  saveSettings(s);
  return { ok: true };
});
ipcMain.handle('ai:analyze', async (_e, text) => {
  try { return { ok: true, questions: await callAI(String(text || '')) }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('open:external', (_e, url) => {
  if (/^https:\/\//i.test(url)) shell.openExternal(url);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 600,
    backgroundColor: '#F3F5F8', title: 'AI Study Assistant',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    // Liên kết mở cửa sổ mới sẽ mở ngay trong khung web, chỉ cho http/https
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) contents.loadURL(url);
      return { action: 'deny' };
    });
  }
});

app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => app.quit());
