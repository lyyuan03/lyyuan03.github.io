import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../courses/male-yoga-course-admin.js", import.meta.url), "utf8");
const ADMIN = { uid: "admin", email: "lyyuan03@gmail.com", emailVerified: true };
class Element {
  hidden = true; open = false; disabled = false; value = ""; textContent = "";
  dataset = {}; children = []; events = new Map(); selectors = new Map();
  constructor(tag = "div") { this.tag = tag; }
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());
    return this.selectors.get(selector);
  }
  querySelectorAll() { return this.children.flatMap((child) => child.tag === "button" ? [child] : child.querySelectorAll()); }
  addEventListener(type, listener) { this.events.set(type, listener); }
  async fire(type) { return this.events.get(type)?.({ preventDefault() {} }); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
}

async function harness(user = ADMIN, records = {}, options = {}) {
  const dialog = new Element("dialog");
  const open = new Element("button");
  const content = new Element("a");
  const auth = { currentUser: user };
  let authListener;
  let queries = 0;
  let writes = 0;
  const data = structuredClone(records);
  const snapshot = (id) => ({ id, exists: () => Boolean(data[id]), data: () => data[id] });
  const document = {
    getElementById: () => dialog,
    querySelector: (selector) => selector.includes("admin-open") ? open : content,
    createElement: (tag) => new Element(tag)
  };
  const config = { auth, db: {}, isAdminEmail: (email) => email?.trim().toLowerCase() === ADMIN.email };
  const authSdk = {
    onAuthStateChanged: (_, callback) => { authListener = callback; callback(user); },
    signOut: async () => { auth.currentUser = null; authListener(null); }
  };
  const firestoreSdk = {
    doc: (_, collection, id) => ({ collection, id }), collection: () => ({}),
    query: () => ({}), where: () => ({}),
    arrayUnion: (value) => ({ union: value }), arrayRemove: (value) => ({ remove: value }), serverTimestamp: () => "server-time",
    getDocsFromServer: async () => {
      queries += 1;
      if (options.list) return options.list();
      return { docs: Object.keys(data).filter((email) => data[email].permissions?.includes("male-yoga-beginner")).map(snapshot) };
    },
    runTransaction: async (_, callback) => {
      if (options.fail) throw Object.assign(new Error("offline"), { code: "unavailable" });
      const pending = [];
      await callback({
        get: async (ref) => { if (options.beforeRead) await options.beforeRead(); return snapshot(ref.id); },
        set: (ref, payload) => pending.push([ref, payload]),
        update: (ref, payload) => pending.push([ref, payload])
      });
      for (const [ref, payload] of pending) {
        const previous = data[ref.id] || {};
        const transform = payload.permissions;
        const permissions = transform.union
          ? [...new Set([...(previous.permissions || []), transform.union])]
          : (previous.permissions || []).filter((item) => item !== transform.remove);
        data[ref.id] = { ...previous, ...payload, permissions };
        writes += 1;
      }
    }
  };
  const context = vm.createContext({ document, window: { confirm: () => true }, console });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async (specifier) => {
    const exports = specifier.includes("firebase-config") ? config : specifier.includes("firebase-auth") ? authSdk : firestoreSdk;
    const linked = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
    return linked;
  });
  await module.evaluate();
  return {
    dialog, open, content, data,
    queries: () => queries, writes: () => writes,
    field: (selector) => dialog.querySelector(selector),
    setUser: (user) => { auth.currentUser = user; authListener(user); },
    submit: async (value) => {
      dialog.querySelector("#course-admin-emails").value = value;
      await dialog.querySelector("[data-course-admin-form]").fire("submit");
    }
  };
}

test("訪客、學員、相似帳號及未驗證帳號皆無法開啟或寫入", async () => {
  for (const user of [null, { ...ADMIN, email: "student@gmail.com" }, { ...ADMIN, email: "lyuan03@gmail.com" }, { ...ADMIN, emailVerified: false }]) {
    const h = await harness(user);
    assert.equal(h.open.hidden, true);
    await h.open.fire("click");
    await h.submit("student@gmail.com");
    assert.equal(h.dialog.open, false);
    assert.equal(h.queries(), 0);
    assert.equal(h.writes(), 0);
  }
});

test("開通會正規化與去重，保留既有會員及其他課程權限", async () => {
  const h = await harness(ADMIN, { "student@gmail.com": { email: "student@gmail.com", permissions: ["other-course"], sponsorExpiresAt: "expiry", status: "inactive" } });
  assert.equal(h.open.hidden, false);
  await h.submit(" Student@Gmail.com,student@gmail.com\nnew@gmail.com ");
  assert.deepEqual(h.data["student@gmail.com"].permissions, ["other-course", "male-yoga-beginner"]);
  assert.equal(h.data["student@gmail.com"].sponsorExpiresAt, "expiry");
  assert.equal(h.data["student@gmail.com"].status, "inactive");
  assert.equal(h.data["new@gmail.com"].schemaVersion, 1);
  assert.equal(h.writes(), 2);
  assert.equal(h.field("[data-course-admin-status]").dataset.kind, "success");
  await h.submit("student@gmail.com");
  assert.deepEqual(h.data["student@gmail.com"].permissions, ["other-course", "male-yoga-beginner"]);
});

test("錯誤格式及包含停用帳號的批次不會部分開通", async () => {
  const h = await harness(ADMIN, { "blocked@gmail.com": { status: "disabled" } });
  for (const input of ["", "student@example.com", "x/evil@gmail.com", "new@gmail.com,blocked@gmail.com"]) {
    await h.submit(input);
    assert.equal(h.writes(), 0);
    assert.equal(h.field("[data-course-admin-status]").dataset.kind, "error");
  }
});

test("網路失敗保留輸入並解除提交中的狀態", async () => {
  const h = await harness(ADMIN, {}, { fail: true });
  await h.submit("student@gmail.com");
  assert.equal(h.writes(), 0);
  assert.equal(h.field("#course-admin-emails").value, "student@gmail.com");
  assert.equal(h.field("#course-admin-emails").disabled, false);
  assert.equal(h.field("[data-course-admin-status]").dataset.kind, "error");
});

test("取消權限僅移除本課程，保留其他資料", async () => {
  const h = await harness(ADMIN, { "student@gmail.com": { permissions: ["other-course", "male-yoga-beginner"], sponsorArticleAccess: true } });
  await h.open.fire("click");
  await new Promise(setImmediate);
  const row = h.field("[data-course-admin-list]").children[0];
  await row.children[1].fire("click");
  assert.deepEqual(h.data["student@gmail.com"].permissions, ["other-course"]);
  assert.equal(h.data["student@gmail.com"].sponsorArticleAccess, true);
});

test("等待資料時切換帳號會清除私人資料並放棄寫入", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const h = await harness(ADMIN, {}, { beforeRead: () => pending });
  await h.open.fire("click");
  const submit = h.submit("student@gmail.com");
  h.setUser({ ...ADMIN, uid: "learner", email: "learner@gmail.com" });
  release();
  await submit;
  assert.equal(h.writes(), 0);
  assert.equal(h.dialog.open, false);
  assert.equal(h.open.hidden, true);
  assert.equal(h.field("#course-admin-emails").value, "");
  assert.equal(h.field("[data-course-admin-list]").children.length, 0);
});

test("登出後到達的名單回應不會重新顯示學生信箱", async () => {
  let release;
  const h = await harness(ADMIN, {}, { list: () => new Promise((resolve) => { release = resolve; }) });
  await h.open.fire("click");
  h.setUser(null);
  release({ docs: [{ id: "private@gmail.com" }] });
  await new Promise(setImmediate);
  assert.equal(h.field("[data-course-admin-list]").children.length, 0);
  assert.equal(h.field("[data-course-admin-account]").textContent, "");
});


test("初階頁先確認已開通權限，再嘗試讀取限定正文；內容未發布不誤報未開通", () => {
  const html = fs.readFileSync(new URL("../../courses/male-yoga-energy.html", import.meta.url), "utf8");
  const entitlementRead = html.indexOf('getDocFromServer(doc(db, "memberEntitlements", email))');
  const articleRead = html.indexOf('getDocFromServer(doc(db, "eventArticleBodies", BODY_ID))');
  assert.ok(entitlementRead > 0 && articleRead > entitlementRead, "應先讀取已開通名單");
  assert.ok(html.includes('entitlement.permissions.includes(PERMISSION)'));
  assert.ok(html.includes('showAuthorizedMessage(adminReader)'));
  assert.ok(html.includes('else if (accessVerified) showAuthorizedMessage(adminReader, true)'));
  assert.ok(html.includes('gate.hidden = true;'));
});
