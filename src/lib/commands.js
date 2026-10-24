import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Eye,
  FileImage,
  FilePlus,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Globe,
  Grid3x3,
  Group,
  Keyboard,
  Lock,
  Magnet,
  Maximize,
  MousePointerClick,
  Play,
  Plus,
  Redo2,
  Ruler,
  Save,
  Scan,
  Scissors,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { TankIcon } from "../components/icons.jsx";

/** Every command, for the Ctrl+K palette. */
export function buildCommands(a) {
  const ed = a.editor;
  const ids = a.selection.map((e) => e.id);
  const has = ids.length > 0;
  const editing = a.mode === "edit";
  const c = (id, label, group, run, extra = {}) => ({ id, label, group, run, ...extra });
  return [
    c("add-text", "Add text", "Add", () => a.onAdd("text"), { icon: Type, disabled: !editing }),
    c("add-meme", "Add meme caption", "Add", () => a.onAdd("meme"), { icon: Type, disabled: !editing }),
    c("add-image", "Add a picture…", "Add", () => a.onAdd("image"), { icon: FileImage, disabled: !editing }),
    c("add-button", "Add a button", "Add", () => a.onAdd("button"), { icon: MousePointerClick, disabled: !editing }),
    c("add-glass", "Add a glass panel", "Add", () => a.onAdd("glass"), { icon: Sparkles, disabled: !editing }),
    c("add-shape", "Add a box", "Add", () => a.onAdd("rect"), { icon: Square, disabled: !editing }),
    c("add-star", "Add a star", "Add", () => a.onAdd("star"), { icon: Shapes, disabled: !editing }),
    c("add-vehicle", "Add a tank (3D)", "Add", () => a.setVehiclePicker(true), { icon: TankIcon, disabled: !editing, keywords: ["vehicle", "war thunder", "tiger", "sherman"] }),
    c("workshop", "Open the Vehicle Workshop", "Vehicles", () => a.openWorkshop((a.selection[0]?.type === "vehicle" && a.selection[0].vehicle) || undefined, a.selection[0]?.type === "vehicle" ? "edit" : "insert", a.selection[0]?.type === "vehicle" ? a.selection[0].id : null), { icon: Wrench, keywords: ["tank", "build", "hangar"] }),
    c("undo", "Undo", "Edit", ed.undo, { icon: Undo2, shortcut: "Ctrl+Z", disabled: !ed.canUndo }),
    c("redo", "Redo", "Edit", ed.redo, { icon: Redo2, shortcut: "Ctrl+Y", disabled: !ed.canRedo }),
    c("select-all", "Select all", "Edit", () => ed.select(ed.page.elements.map((e) => e.id), { deep: true }), { shortcut: "Ctrl+A", disabled: !editing }),
    c("copy", "Copy", "Edit", () => a.copy(), { icon: Copy, shortcut: "Ctrl+C", disabled: !has }),
    c("cut", "Cut", "Edit", () => a.copy(true), { icon: Scissors, shortcut: "Ctrl+X", disabled: !has }),
    c("paste", "Paste", "Edit", a.paste, { icon: ClipboardPaste, shortcut: "Ctrl+V", disabled: !editing }),
    c("duplicate", "Duplicate", "Edit", () => ed.duplicateElements(ids), { icon: Copy, shortcut: "Ctrl+D", disabled: !has }),
    c("delete", "Delete", "Edit", () => ed.removeElements(ids), { icon: Trash2, shortcut: "Del", disabled: !has }),
    c("group", "Group", "Arrange", () => ed.group(ids), { icon: Group, shortcut: "Ctrl+G", disabled: ids.length < 2 }),
    c("ungroup", "Ungroup", "Arrange", () => ed.ungroup(ids), { icon: Ungroup, shortcut: "Ctrl+Shift+G", disabled: !has }),
    c("front", "Bring to front", "Arrange", () => ed.moveLayers(ids, "front"), { icon: ArrowUpToLine, disabled: !has }),
    c("back", "Send to back", "Arrange", () => ed.moveLayers(ids, "back"), { icon: ArrowDownToLine, disabled: !has }),
    ...[
      ["left", "Align left", AlignStartVertical],
      ["hcenter", "Align centre", AlignCenterVertical],
      ["right", "Align right", AlignEndVertical],
      ["top", "Align top", AlignStartHorizontal],
      ["vcenter", "Align middle", AlignCenterHorizontal],
      ["bottom", "Align bottom", AlignEndHorizontal],
    ].map(([how, label, icon]) => c(`align-${how}`, label, "Arrange", () => ed.align(ids, how), { icon, disabled: !has })),
    c("flip-x", "Flip left-right", "Arrange", () => ed.mirror(ids, "x"), { icon: FlipHorizontal2, shortcut: "Shift+H", disabled: !has, keywords: ["mirror"] }),
    c("flip-y", "Flip upside down", "Arrange", () => ed.mirror(ids, "y"), { icon: FlipVertical2, shortcut: "Shift+V", disabled: !has, keywords: ["mirror"] }),
    c("mirror-copy-x", "Mirror copy (left-right)", "Arrange", () => ed.mirror(ids, "x", { copy: true }), { icon: FlipHorizontal2, disabled: !has, keywords: ["symmetry", "face off"] }),
    c("mirror-copy-y", "Mirror copy (top-bottom)", "Arrange", () => ed.mirror(ids, "y", { copy: true }), { icon: FlipVertical2, disabled: !has, keywords: ["symmetry"] }),
    c("dist-x", "Spread out horizontally", "Arrange", () => ed.distribute(ids, "x"), { disabled: ids.length < 3 }),
    c("dist-y", "Spread out vertically", "Arrange", () => ed.distribute(ids, "y"), { disabled: ids.length < 3 }),
    c("grid", a.grid.show ? "Hide the grid" : "Show the grid", "View", () => a.setGrid((g) => ({ ...g, show: !g.show })), { icon: Grid3x3, shortcut: "Ctrl+'" }),
    c("snap", a.grid.snap ? "Stop snapping to the grid" : "Snap to the grid", "View", () => a.setGrid((g) => ({ ...g, snap: !g.snap })), { icon: Magnet }),
    c("rulers", a.rulers ? "Hide rulers" : "Show rulers", "View", () => a.setRulers((r) => !r), { icon: Ruler }),
    c("zoom-fit", "Zoom to fit", "View", () => a.canvasRef.current?.zoomFit(), { icon: Maximize, shortcut: "Shift+1" }),
    c("zoom-sel", "Zoom to selection", "View", () => a.canvasRef.current?.zoomToSelection(), { icon: Scan, shortcut: "Shift+2", disabled: !has }),
    c("zoom-in", "Zoom in", "View", () => a.canvasRef.current?.zoomIn(), { icon: ZoomIn, shortcut: "Ctrl +" }),
    c("zoom-out", "Zoom out", "View", () => a.canvasRef.current?.zoomOut(), { icon: ZoomOut, shortcut: "Ctrl −" }),
    c("anim", a.animate ? "Stop animations in the editor" : "Play animations in the editor", "View", () => a.setAnimate((x) => !x), { icon: Play }),
    c("preview", "Preview", "View", () => a.setMode("preview"), { icon: Eye, shortcut: "F5" }),
    c("add-page", "Add a page", "Pages", ed.addPage, { icon: Plus, disabled: !editing }),
    c("new", "New project", "File", a.newProject, { icon: FilePlus, shortcut: "Ctrl+N" }),
    c("open", "Open a project…", "File", a.openDialog, { icon: FolderOpen, shortcut: "Ctrl+O" }),
    c("save", "Save", "File", () => a.save(), { icon: Save, shortcut: "Ctrl+S" }),
    c("home", "Go to Home (all projects)", "File", a.goHome, { icon: FolderOpen }),
    c("save-as", "Save as a file…", "File", () => a.save({ saveAs: true }), { icon: Save, shortcut: "Ctrl+Shift+S" }),
    c("png", "Export PNG", "File", a.exportPng, { icon: FileImage, shortcut: "Ctrl+E" }),
    c("html", "Export web page", "File", a.exportHtml, { icon: Globe }),
    c("shortcuts", "Keyboard shortcuts", "Help", () => a.setShortcuts(true), { icon: Keyboard, shortcut: "F1" }),
  ];
}

/** Right-click menu for a layer (id) or the empty canvas (no id). */
export function contextItems(a, id) {
  const ed = a.editor;
  const sel = a.selection;
  const ids = sel.map((e) => e.id);
  if (!id || !ids.length) {
    return [
      { label: "Paste", icon: ClipboardPaste, shortcut: "Ctrl+V", onClick: a.paste },
      { label: "Select all", shortcut: "Ctrl+A", onClick: () => ed.select(ed.page.elements.map((e) => e.id), { deep: true }) },
      "-",
      {
        label: "Add",
        icon: Plus,
        items: [
          { label: "Text", icon: Type, onClick: () => a.onAdd("text") },
          { label: "Meme caption", icon: Type, onClick: () => a.onAdd("meme") },
          { label: "Picture…", icon: FileImage, onClick: () => a.onAdd("image") },
          { label: "Button", icon: MousePointerClick, onClick: () => a.onAdd("button") },
          { label: "Glass panel", icon: Sparkles, onClick: () => a.onAdd("glass") },
          { label: "Tank (3D)", icon: TankIcon, onClick: () => a.setVehiclePicker(true) },
        ],
      },
      "-",
      { label: a.grid.show ? "Hide grid" : "Show grid", icon: Grid3x3, onClick: () => a.setGrid((g) => ({ ...g, show: !g.show })) },
      { label: "Zoom to fit", icon: Maximize, onClick: () => a.canvasRef.current?.zoomFit() },
    ];
  }
  const locked = sel.every((e) => e.locked);
  const grouped = sel.some((e) => e.group);
  const vehicle = sel.length === 1 && sel[0].type === "vehicle" ? sel[0] : null;
  return [
    vehicle && { label: "Open in Workshop", icon: Wrench, onClick: () => a.openWorkshop(vehicle.vehicle, "edit", vehicle.id) },
    vehicle && "-",
    { label: "Cut", icon: Scissors, shortcut: "Ctrl+X", onClick: () => a.copy(true) },
    { label: "Copy", icon: Copy, shortcut: "Ctrl+C", onClick: () => a.copy() },
    { label: "Paste", icon: ClipboardPaste, shortcut: "Ctrl+V", onClick: a.paste },
    { label: "Duplicate", icon: Copy, shortcut: "Ctrl+D", onClick: () => ed.duplicateElements(ids) },
    "-",
    { label: "Bring to front", icon: ArrowUpToLine, shortcut: "Ctrl+]", onClick: () => ed.moveLayers(ids, "front") },
    { label: "Bring forward", icon: ChevronUp, shortcut: "]", onClick: () => ed.moveLayers(ids, 1) },
    { label: "Send backward", icon: ChevronDown, shortcut: "[", onClick: () => ed.moveLayers(ids, -1) },
    { label: "Send to back", icon: ArrowDownToLine, shortcut: "Ctrl+[", onClick: () => ed.moveLayers(ids, "back") },
    "-",
    ids.length > 1 && !grouped ? { label: "Group", icon: Group, shortcut: "Ctrl+G", onClick: () => ed.group(ids) } : null,
    grouped ? { label: "Ungroup", icon: Ungroup, shortcut: "Ctrl+Shift+G", onClick: () => ed.ungroup(ids) } : null,
    {
      label: ids.length > 1 ? "Align" : "Align to page",
      icon: AlignCenterVertical,
      items: [
        ["left", "Left", AlignStartVertical],
        ["hcenter", "Centre", AlignCenterVertical],
        ["right", "Right", AlignEndVertical],
        ["top", "Top", AlignStartHorizontal],
        ["vcenter", "Middle", AlignCenterHorizontal],
        ["bottom", "Bottom", AlignEndHorizontal],
      ].map(([how, label, icon]) => ({ label, icon, onClick: () => ed.align(ids, how) })),
    },
    {
      label: "Mirror",
      icon: FlipHorizontal2,
      items: [
        { label: "Flip left-right", icon: FlipHorizontal2, shortcut: "Shift+H", onClick: () => ed.mirror(ids, "x") },
        { label: "Flip upside down", icon: FlipVertical2, shortcut: "Shift+V", onClick: () => ed.mirror(ids, "y") },
        { label: "Mirror copy ↔", icon: FlipHorizontal2, onClick: () => ed.mirror(ids, "x", { copy: true }) },
        { label: "Mirror copy ↕", icon: FlipVertical2, onClick: () => ed.mirror(ids, "y", { copy: true }) },
      ],
    },
    { label: locked ? "Unlock" : "Lock", icon: Lock, shortcut: "Ctrl+L", onClick: () => ed.updateElements(ids, (e) => ({ ...e, locked: !locked }), { step: true }) },
    "-",
    { label: "Delete", icon: Trash2, shortcut: "Del", danger: true, onClick: () => ed.removeElements(ids) },
  ].filter((x) => x !== null && x !== false);
}
