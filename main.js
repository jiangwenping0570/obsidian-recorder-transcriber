"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RecorderTranscriberPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  apiKey: "",
  relayUrl: "http://47.112.162.47:8765",
  outputFolder: "\u8F6C\u5F55\u7B14\u8BB0",
  maxDurationMinutes: 5
};
var MAX_DURATION_SECONDS = 5 * 60;
var RecorderTranscriberPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("microphone", "\u5BFC\u5165\u5F55\u97F3\u5E76\u8F6C\u6587\u5B57", () => {
      this.selectAndTranscribe();
    });
    this.addCommand({
      id: "select-and-transcribe",
      name: "\u9009\u62E9\u5F55\u97F3\u6587\u4EF6\u5E76\u8F6C\u6587\u5B57",
      callback: () => this.selectAndTranscribe()
    });
    this.addSettingTab(new RecorderTranscriberSettingTab(this.app, this));
  }
  async selectAndTranscribe() {
    if (!this.settings.apiKey) {
      new import_obsidian.Notice("\u26A0\uFE0F \u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key\uFF08\u963F\u91CC\u4E91\u767E\u70BC\uFF09");
      this.app.setting.open();
      this.app.setting.openTabById(this.manifest.id);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.wav,.mp3,.m4a,.webm,.mp4,.aac,.flac,.ogg";
    input.onchange = async (event) => {
      var _a;
      const file = (_a = event.target.files) == null ? void 0 : _a[0];
      if (!file)
        return;
      try {
        const duration = await this.getAudioDuration(file);
        if (duration > MAX_DURATION_SECONDS) {
          new import_obsidian.Notice(`\u26A0\uFE0F \u97F3\u9891\u8FC7\u957F\uFF08${Math.round(duration / 60)}\u5206\u949F\uFF09\uFF0C\u6682\u4E0D\u652F\u6301\u8D85\u8FC7 ${this.settings.maxDurationMinutes} \u5206\u949F`);
          return;
        }
      } catch (err) {
        console.warn("\u65E0\u6CD5\u83B7\u53D6\u97F3\u9891\u65F6\u957F\uFF0C\u8DF3\u8FC7\u68C0\u67E5:", err);
      }
      new import_obsidian.Notice("\u{1F4E4} \u6B63\u5728\u53D1\u9001\u5230\u670D\u52A1\u5668\u8F6C\u5199\u2026");
      try {
        const text = await this.transcribeAudio(file);
        await this.appendToDailyNote(text, file.name);
        new import_obsidian.Notice("\u2705 \u8F6C\u5199\u5B8C\u6210\uFF01\u5DF2\u6DFB\u52A0\u5230\u4ECA\u65E5\u7B14\u8BB0");
      } catch (error) {
        console.error("\u8F6C\u5199\u5931\u8D25:", error);
        new import_obsidian.Notice("\u274C " + error.message);
      }
    };
    input.click();
  }
  // ===== 获取音频时长（秒）=====
  async getAudioDuration(file) {
    if (file.name.toLowerCase().endsWith(".wav")) {
      const buffer = await file.slice(0, 100).arrayBuffer();
      const view = new DataView(buffer);
      const sampleRate = view.getUint32(24, true);
      const byteRate = view.getUint32(28, true);
      const dataSize = view.getUint32(40, true);
      if (byteRate > 0) {
        return dataSize / byteRate;
      }
    }
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.duration;
  }
  async transcribeAudio(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    const relayUrl = this.settings.relayUrl.replace(/\/+$/, "");
    const response = await (0, import_obsidian.requestUrl)({
      url: `${relayUrl}/transcribe`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.settings.apiKey
      },
      body: JSON.stringify({
        audio_data: base64Data,
        filename: file.name
      })
    });
    const result = response.json;
    if (result.success && result.text) {
      return result.text;
    } else if (result.error) {
      throw new Error(result.error);
    } else {
      throw new Error("\u8F6C\u5199\u5931\u8D25: " + JSON.stringify(result));
    }
  }
  // ===== 追加到今日笔记 =====
  async appendToDailyNote(text, fileName) {
    const folderPath = this.settings.outputFolder;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const noteName = `${folderPath}/${dateStr}.md`;
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const newSection = [
      "",
      `## ${timeStr} \u2014 ${baseName}`,
      "",
      text,
      ""
    ].join("\n");
    const existingFile = this.app.vault.getAbstractFileByPath(noteName);
    if (existingFile instanceof import_obsidian.TFile) {
      const existingContent = await this.app.vault.read(existingFile);
      const trimmed = existingContent.replace(/\s+$/, "");
      const updatedContent = trimmed + newSection;
      await this.app.vault.modify(existingFile, updatedContent);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(existingFile);
    } else {
      const content = [
        "---",
        `title: "${dateStr} \u5F55\u97F3\u8F6C\u5199"`,
        `date: ${dateStr}`,
        "---",
        "",
        newSection.trim(),
        ""
      ].join("\n");
      const noteFile = await this.app.vault.create(noteName, content);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(noteFile);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var RecorderTranscriberSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian\u5F55\u97F3\u8F6C\u6587\u5B57 - \u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u963F\u91CC\u4E91\u767E\u70BC API Key").setDesc("\u7528\u4E8E\u8BED\u97F3\u8F6C\u5199\u7684 API Key").addText(
      (text) => text.setPlaceholder("sk-xxxxxxxxxxxx").setValue(this.plugin.settings.apiKey).onChange(async (v) => {
        this.plugin.settings.apiKey = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u4E2D\u7EE7\u670D\u52A1\u5668\u5730\u5740").setDesc("\u4F60\u7684\u963F\u91CC\u4E91\u670D\u52A1\u5668\u5730\u5740").addText(
      (text) => text.setValue(this.plugin.settings.relayUrl).onChange(async (v) => {
        this.plugin.settings.relayUrl = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u8F93\u51FA\u6587\u4EF6\u5939").setDesc("\u8F6C\u5199\u7B14\u8BB0\u4FDD\u5B58\u5230 Obsidian \u7684\u54EA\u4E2A\u6587\u4EF6\u5939").addText(
      (text) => text.setPlaceholder("\u8F6C\u5F55\u7B14\u8BB0").setValue(this.plugin.settings.outputFolder).onChange(async (v) => {
        this.plugin.settings.outputFolder = v;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u4F7F\u7528\u8BF4\u660E" });
    const el = containerEl.createDiv();
    el.innerHTML = `
            <ol style="margin-left: 20px; font-size: 13px; color: var(--text-muted);">
                <li>\u624B\u673A\u5F55\u5236\u97F3\u9891\uFF0C\u4FDD\u5B58\u5230 Download/\u963F\u4E03\u5F55\u97F3/</li>
                <li>\u6253\u5F00 Obsidian\uFF0C\u70B9 \u{1F3A4} \u6309\u94AE\uFF0C\u9009\u62E9\u97F3\u9891\u6587\u4EF6</li>
                <li>\u26A0\uFE0F \u5355\u6B21\u97F3\u9891\u4E0D\u8D85\u8FC7 5 \u5206\u949F</li>
                <li>\u7B49\u5F85 10-60 \u79D2\uFF0C\u6587\u5B57\u8FFD\u52A0\u5230\u4ECA\u65E5\u7B14\u8BB0</li>
                <li>\u540C\u4E00\u5929\u7684\u5F55\u97F3\u4F1A\u81EA\u52A8\u6C47\u603B\u5230\u540C\u4E00\u7BC7\u7B14\u8BB0</li>
            </ol>
        `;
  }
};
