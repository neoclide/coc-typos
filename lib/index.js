var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/debounce/index.js
var require_debounce = __commonJS({
  "node_modules/debounce/index.js"(exports, module2) {
    function debounce2(func, wait, immediate) {
      var timeout, args, context, timestamp, result;
      if (wait == null)
        wait = 100;
      function later() {
        var last = Date.now() - timestamp;
        if (last < wait && last >= 0) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = func.apply(context, args);
            context = args = null;
          }
        }
      }
      ;
      var debounced = function() {
        context = this;
        args = arguments;
        timestamp = Date.now();
        var callNow = immediate && !timeout;
        if (!timeout)
          timeout = setTimeout(later, wait);
        if (callNow) {
          result = func.apply(context, args);
          context = args = null;
        }
        return result;
      };
      debounced.clear = function() {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      };
      debounced.flush = function() {
        if (timeout) {
          result = func.apply(context, args);
          context = args = null;
          clearTimeout(timeout);
          timeout = null;
        }
      };
      return debounced;
    }
    debounce2.debounce = debounce2;
    module2.exports = debounce2;
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(src_exports);
var import_coc4 = require("coc.nvim");

// src/ignored.ts
var import_coc2 = require("coc.nvim");
var import_fs2 = __toESM(require("fs"));

// src/util.ts
var import_child_process = require("child_process");
var import_coc = require("coc.nvim");
var import_debounce = __toESM(require_debounce());
var import_fs = __toESM(require("fs"));
function spawnCommand(cmd, args, stdin) {
  const cp = (0, import_child_process.spawn)(cmd, args, { cwd: process.cwd(), serialization: "advanced" });
  let res = "";
  return new Promise((resolve, reject) => {
    cp.on("error", (err) => {
      reject(err);
    });
    cp.stdin.write(stdin);
    cp.stdin.end();
    cp.stdout.on("data", (data) => {
      res += data.toString();
    });
    cp.stderr.on("data", (data) => {
      import_coc.window.showErrorMessage(`"${cmd} ${args.join(" ")}" error: ${data.toString()}`);
    });
    cp.on("close", (code) => {
      resolve(res);
    });
  });
}
function getTypos(cmd, content) {
  let res = [];
  return new Promise((resolve, reject) => {
    spawnCommand(cmd, ["--format=json", "-"], content).then((text) => {
      if (text) {
        let lines = text.split(/\r?\n/);
        for (let line of lines) {
          if (line.length) {
            try {
              let obj = JSON.parse(line);
              res.push({
                type: obj.type,
                word: obj.typo,
                lnum: obj.line_num - 1,
                colStart: obj.byte_offset,
                colEnd: obj.byte_offset + Buffer.byteLength(obj.typo),
                corrections: obj.corrections
              });
            } catch (e) {
            }
          }
        }
      }
      res.sort((a, b) => {
        if (a.lnum != b.lnum)
          return a.lnum - b.lnum;
        return a.colStart - b.colStart;
      });
      resolve(res);
    }, reject);
  });
}
function padLeft(s, n, pad = " ") {
  return pad.repeat(Math.max(0, n - s.length)) + s;
}
function now() {
  const now2 = new Date();
  return padLeft(now2.getUTCHours() + "", 2, "0") + ":" + padLeft(now2.getMinutes() + "", 2, "0") + ":" + padLeft(now2.getUTCSeconds() + "", 2, "0") + "." + now2.getMilliseconds();
}
function watchFile(filepath, onChange) {
  let callback = (0, import_debounce.default)(onChange, 100);
  try {
    let watcher = import_fs.default.watch(filepath, {
      persistent: true,
      recursive: false,
      encoding: "utf8"
    }, () => {
      callback();
    });
    return import_coc.Disposable.create(() => {
      callback.clear();
      watcher.close();
    });
  } catch (e) {
    return import_coc.Disposable.create(() => {
      callback.clear();
    });
  }
}

// src/ignored.ts
var Ignored = class {
  constructor(output) {
    this.output = output;
    this.ignoredWords = /* @__PURE__ */ new Map();
    this.files = [];
    this.disposables = [];
    this._onDidChange = new import_coc2.Emitter();
    this.onDidChange = this._onDidChange.event;
    import_coc2.workspace.nvim.getOption("spellfile").then((spellfile) => {
      if (spellfile) {
        this.files = spellfile.split(",").map((s) => import_coc2.workspace.expand(s));
        for (let file of this.files) {
          this.watchFile(file);
        }
        this.loadFiles();
      }
    });
  }
  loadFiles() {
    for (let file of this.files) {
      this.loadFile(file);
    }
  }
  watchFile(filepath) {
    this.output.appendLine(`[Info - ${now()}] Watching spellfile ${filepath}`);
    this.disposables.push(watchFile(filepath, () => {
      this.loadFile(filepath, true);
    }));
  }
  loadFile(filepath, fireEvent = false) {
    if (!import_fs2.default.existsSync(filepath))
      return;
    import_fs2.default.readFile(filepath, "utf8", (err, data) => {
      if (err)
        return;
      let words = data.trim().split(/\r?\n/);
      this.ignoredWords.set(filepath, words);
      this.output.appendLine(`[Info - ${now()}] Loaded ${words.length} words from spellfile ${filepath}`);
      if (fireEvent)
        this._onDidChange.fire();
    });
  }
  isIgnored(word) {
    for (let words of this.ignoredWords.values()) {
      if (words.includes(word))
        return true;
    }
    return false;
  }
  dispose() {
    (0, import_coc2.disposeAll)(this.disposables);
  }
};

// src/item.ts
var import_coc3 = require("coc.nvim");
var import_util2 = require("util");
var NAMESPACE = "typos";
var TyposBuffer = class {
  constructor(doc, config, output, checkIgnored) {
    this.doc = doc;
    this.config = config;
    this.output = output;
    this.checkIgnored = checkIgnored;
    this.check();
  }
  get buffer() {
    return this.doc.buffer;
  }
  cancel() {
    if (this.tokenSource) {
      this.tokenSource.cancel();
      this.tokenSource = void 0;
    }
  }
  onChange() {
    if (this.config.disabledFiletypes.includes(this.doc.filetype))
      return;
    process.nextTick(() => {
      this.check();
    });
  }
  addHighlights() {
    if (!this.typos)
      return;
    let hlGroup = this.config.highlightGroup;
    let items = [];
    for (let o of this.typos) {
      if (this.checkIgnored(o.word))
        continue;
      items.push({
        hlGroup,
        lnum: o.lnum,
        colEnd: o.colEnd,
        colStart: o.colStart,
        start_incl: false,
        end_incl: false
      });
    }
    this.buffer.updateHighlights(NAMESPACE, items);
    import_coc3.workspace.nvim.redrawVim();
  }
  findTypo(lnum, col) {
    if (!this.typos)
      return void 0;
    return this.typos.find((o) => o.lnum == lnum && o.colStart <= col && o.colEnd >= col);
  }
  check() {
    let { doc } = this;
    if (!doc.attached)
      return;
    if (this.config.disabledFiletypes.includes(doc.filetype)) {
      this.warn(`${doc.uri} ignored by typos.disabledFiletypes`, doc.filetype);
      return;
    }
    this.cancel();
    let cmd = this.config.command;
    let tokenSource = this.tokenSource = new import_coc3.CancellationTokenSource();
    let token = tokenSource.token;
    getTypos(this.config.command, doc.textDocument.getText()).then((typos) => {
      if (token.isCancellationRequested)
        return;
      this.typos = typos;
      this.info(`${typos.length} typos found for ${doc.uri}.`);
      this.addHighlights();
    }, (e) => {
      if (token.isCancellationRequested)
        return;
      this.error(`Error on command: ${cmd}`, e);
    });
  }
  info(message, data) {
    this.logLevel("Info", message, data);
  }
  warn(message, data) {
    this.logLevel("Warn", message, data);
  }
  error(message, data) {
    this.logLevel("Error", message, data);
  }
  logLevel(level, message, data) {
    this.output.appendLine(`[${level} - ${now()}] ${message}`);
    if (data)
      this.output.appendLine(this.data2String(data));
  }
  data2String(data) {
    if (data instanceof Error) {
      if (typeof data.stack === "string") {
        return data.stack;
      }
      return data.message;
    }
    if (typeof data === "string" || typeof data === "boolean") {
      return data.toString();
    }
    return (0, import_util2.inspect)(data, { maxArrayLength: 5 });
  }
  dispose() {
    this.cancel();
    this.typos = void 0;
  }
};

// src/index.ts
async function getHighlights() {
  let buf = await import_coc4.workspace.nvim.buffer;
  return await buf.getHighlights(NAMESPACE);
}
function jumpTo(item) {
  import_coc4.workspace.nvim.call("cursor", [item.lnum + 1, item.colStart + 1], true);
}
async function activate(context) {
  let { subscriptions } = context;
  let { nvim } = import_coc4.workspace;
  let channel = import_coc4.window.createOutputChannel("typos");
  let ignored = new Ignored(channel);
  subscriptions.push(channel);
  subscriptions.push(ignored);
  let bufferSync = import_coc4.workspace.registerBufferSync((doc) => {
    let config = import_coc4.workspace.getConfiguration("typos", doc.uri);
    return new TyposBuffer(doc, {
      command: config.get("command", "typos"),
      disabledFiletypes: config.get("disabledFiletypes", []),
      highlightGroup: config.get("highlightGroup", "SpellBad")
    }, channel, (word) => {
      return ignored.isIgnored(word);
    });
  });
  const refreshAll = () => {
    for (let item of bufferSync.items) {
      item.addHighlights();
    }
  };
  subscriptions.push(bufferSync);
  subscriptions.push(ignored.onDidChange(() => {
    refreshAll();
  }));
  subscriptions.push(import_coc4.workspace.registerKeymap(["n"], "typos-next", async () => {
    let hls = await getHighlights();
    if (!hls.length)
      return import_coc4.window.showWarningMessage("No typos exists");
    let [lnum, col, wrapscan] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`);
    for (let i = 0; i < hls.length; i++) {
      let item = hls[i];
      if (item.lnum > lnum || item.lnum == lnum && item.colStart > col) {
        jumpTo(item);
        return;
      }
    }
    if (wrapscan)
      jumpTo(hls[0]);
  }, { sync: false }), import_coc4.workspace.registerKeymap(["n"], "typos-prev", async () => {
    let hls = await getHighlights();
    if (!hls.length)
      return import_coc4.window.showWarningMessage("No typos exists");
    let [lnum, col, wrapscan] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`);
    for (let i = hls.length - 1; i >= 0; i--) {
      let item = hls[i];
      if (item.lnum < lnum || item.lnum == lnum && item.colEnd < col) {
        jumpTo(item);
        return;
      }
    }
    if (wrapscan)
      jumpTo(hls[hls.length - 1]);
  }, { sync: false }), import_coc4.workspace.registerKeymap(["n"], "typos-fix", async () => {
    let bufnr = await nvim.call("bufnr", ["%"]);
    let item = bufferSync.getItem(bufnr);
    if (!item)
      return import_coc4.window.showWarningMessage("Document not attached");
    let [lnum, col] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`);
    let typo = item.findTypo(lnum, col);
    if (!typo)
      return import_coc4.window.showWarningMessage("No bad spelled word found at cursor position");
    nvim.call("coc#snippet#show_choices", [typo.lnum + 1, typo.colStart + 1, typo.word.length, typo.corrections], true);
  }, { sync: false }));
  subscriptions.push(import_coc4.commands.registerCommand("typos.reloadSpellfile", () => {
    ignored.loadFiles();
    refreshAll();
  }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=index.js.map
