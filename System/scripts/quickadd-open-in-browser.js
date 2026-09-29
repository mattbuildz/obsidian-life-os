// QuickAdd User Script, bound to Cmd/Ctrl+Shift+B (see .obsidian/hotkeys.json).
// Opens the active file's .html counterpart in the OS default browser via
// Electron's shell.openPath, which — unlike Obsidian's own "Open in default
// app" command — doesn't require the file to already be the active pane.
//
// Any .html file works, not just START-HERE.html/HANDBOOK.html — this vault
// will collect others (reports, generated pages, whatever lands in it).
// Only when nothing .html is active does it fall back to HANDBOOK.html,
// so the shortcut always does something useful instead of nothing.
module.exports = async (params) => {
  const { app } = params;
  const { shell } = require("electron");
  const path = require("path");

  const activeFile = app.workspace.getActiveFile();
  const relPath = activeFile && activeFile.extension === "html"
    ? activeFile.path
    : "HANDBOOK.html";

  const basePath = app.vault.adapter.getBasePath();
  await shell.openPath(path.join(basePath, relPath));
};
