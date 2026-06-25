import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowUp, Box, Boxes, Check, ChevronDown, ChevronRight, CircleAlert, Copy, ExternalLink,
  File, FileImage, FileText, Folder, FolderOpen, Grid2X2, Info, List,
  LoaderCircle, Minus, PanelLeftClose, PanelLeftOpen, Plus,
  RefreshCw, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { hasChildDirectories } from './tree-utils.js';
import './styles.css';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const TYPE_FILTERS = ['all', 'cad', 'pdf', 'text', 'image', 'file'];
const SORT_OPTIONS = [
  ['name', 'Name'],
  ['modified', 'Modified'],
  ['size', 'Size'],
  ['type', 'Type'],
];

function App() {
  const [project, setProject] = useState(null);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [selectedPath, setSelectedPath] = useState(null);
  const [view, setView] = useState('grid');
  const [gridColumns, setGridColumns] = useStoredNumber('cad-browser-grid-columns', 4, 4, 15);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDescending, setSortDescending] = useState(false);
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    loadProject(setProject);
    const stream = new EventSource('/api/events');
    stream.addEventListener('file', (event) => {
      const update = JSON.parse(event.data);
      setProject((current) => current && ({
        ...current,
        files: current.files.map((file) => file.path === update.path ? update : file),
      }));
    });
    return () => stream.close();
  }, []);

  const files = useMemo(() => {
    if (!project) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const searchAllFolders = normalized.length > 0;
    const filtered = project.files.filter((file) => {
      const inFolder = searchAllFolders || !folder || file.parent === folder;
      const matchesSearch = !normalized
        || file.name.toLocaleLowerCase().includes(normalized)
        || file.path.toLocaleLowerCase().includes(normalized)
        || file.analysis?.text?.toLocaleLowerCase().includes(normalized);
      const matchesType = typeFilter === 'all' || file.kind === typeFilter;
      return inFolder && matchesSearch && matchesType;
    });
    const direction = sortDescending ? -1 : 1;
    return filtered.sort((left, right) => compareFiles(left, right, sortBy) * direction);
  }, [project, folder, query, typeFilter, sortBy, sortDescending]);

  const selected = project?.files.find((file) => file.path === selectedPath) ?? null;
  const selectedIndex = files.findIndex((file) => file.path === selectedPath);
  const currentTitle = folder ? folder.split('/').at(-1) : project?.rootName;

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyK' || event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        event.stopPropagation();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (!isTyping && event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === 'Escape') {
        if (previewOpen) setPreviewOpen(false);
        else if (query) setQuery('');
        else if (selectedPath) setSelectedPath(null);
        return;
      }
      if (isTyping || !files.length) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        selectByIndex(Math.min(files.length - 1, Math.max(0, selectedIndex + 1)));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectByIndex(Math.max(0, selectedIndex <= 0 ? 0 : selectedIndex - 1));
      } else if (event.key === 'Enter' && selected) {
        event.preventDefault();
        setPreviewOpen(Boolean(previewUrl(selected)));
      } else if (event.key.toLowerCase() === 'o' && selected) {
        event.preventDefault();
        runFileAction('/api/open', selected.path, 'Opened in the default application');
      } else if (event.key.toLowerCase() === 'r' && selected) {
        event.preventDefault();
        runFileAction('/api/reveal', selected.path, 'Revealed in the file manager');
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [files, previewOpen, query, selected, selectedIndex, selectedPath]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  function selectByIndex(index) {
    const file = files[index];
    if (file) setSelectedPath(file.path);
  }

  async function rescan() {
    const response = await fetch('/api/rescan', { method: 'POST' });
    setProject(await response.json());
    setToast({ message: 'Project rescanned', type: 'success' });
  }

  async function runFileAction(endpoint, filePath, successMessage) {
    try {
      await postFileAction(endpoint, filePath);
      setToast({ message: successMessage, type: 'success' });
    } catch (error) {
      setToast({ message: error.message, type: 'error' });
    }
  }

  async function copyPath(filePath) {
    await navigator.clipboard.writeText(filePath);
    setToast({ message: 'Project path copied', type: 'success' });
  }

  if (!project) return <LoadingScreen />;

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Box size={17} strokeWidth={1.9} /></div>
          <span>CAD Browser</span>
          <span className="project-chip">{project.rootName}</span>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files, paths, and document text"
            aria-label="Search project"
          />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
          <kbd>Ctrl K</kbd>
        </label>
        <div className="top-actions">
          <button className="icon-button" onClick={rescan} title="Rescan project"><RefreshCw size={16} /></button>
          <div className="status-pill"><span className="status-dot" />Local</div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-head">
          <span>Project</span>
          <button className="icon-button quiet" onClick={() => setSidebarOpen(false)} title="Hide project tree"><PanelLeftClose size={17} /></button>
        </div>
        <div className="tree-scroll">
          <TreeNode node={project.tree} activeFolder={folder} onFolder={(value) => { setFolder(value); setQuery(''); }} rootName={project.rootName} />
        </div>
        <div className="sidebar-footer">
          <div><strong>{project.counts.total}</strong> files</div>
          <div><strong>{project.counts.engineering}</strong> indexed</div>
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="sidebar-reveal" onClick={() => setSidebarOpen(true)} title="Show project tree">
          <PanelLeftOpen size={18} />
        </button>
      )}

      <main className="workspace">
        <section className="content-head">
          <div className="content-title">
            <div className="breadcrumbs">
              <button onClick={() => { setFolder(''); setQuery(''); }}>{project.rootName}</button>
              {!query && folder.split('/').filter(Boolean).map((part, index, parts) => (
                <React.Fragment key={`${part}-${index}`}>
                  <ChevronRight size={13} />
                  <button onClick={() => setFolder(parts.slice(0, index + 1).join('/'))}>{part}</button>
                </React.Fragment>
              ))}
              {query && <><ChevronRight size={13} /><span>Search results</span></>}
            </div>
            <h1>{query ? `Search: ${query}` : currentTitle}</h1>
            <p>{files.length} {files.length === 1 ? 'item' : 'items'}{query ? ' across the entire project' : ''}</p>
          </div>
          <div className="browser-toolbar">
            <TypeFilter value={typeFilter} onChange={setTypeFilter} />
            <SortControl value={sortBy} descending={sortDescending} onChange={setSortBy} onDirection={() => setSortDescending((value) => !value)} />
            {view === 'grid' && (
              <div className="grid-scale" aria-label="Tile density">
                <button onClick={() => setGridColumns((value) => Math.min(15, value + 1))} disabled={gridColumns >= 15} title="Smaller tiles"><Minus size={14} /></button>
                <span title={`${gridColumns} columns`}>{gridColumns}</span>
                <button onClick={() => setGridColumns((value) => Math.max(4, value - 1))} disabled={gridColumns <= 4} title="Larger tiles"><Plus size={14} /></button>
              </div>
            )}
            <div className="view-switcher">
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid view"><Grid2X2 size={16} /></button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={17} /></button>
            </div>
          </div>
        </section>

        <section
          className={view === 'grid' ? `file-grid density-${densityFor(gridColumns)}` : 'file-list'}
          style={view === 'grid' ? { '--grid-columns': gridColumns } : undefined}
        >
          {files.map((file, index) => (
            <FileCard
              key={file.path}
              file={file}
              index={index}
              view={view}
              selected={selectedPath === file.path}
              onSelect={() => setSelectedPath(file.path)}
              onOpen={() => runFileAction('/api/open', file.path, 'Opened in the default application')}
            />
          ))}
          {files.length === 0 && <EmptyState query={query} />}
        </section>
      </main>

      <Inspector
        file={selected}
        onClose={() => setSelectedPath(null)}
        onPreview={() => setPreviewOpen(true)}
        onOpen={() => selected && runFileAction('/api/open', selected.path, 'Opened in the default application')}
        onReveal={() => selected && runFileAction('/api/reveal', selected.path, 'Revealed in the file manager')}
        onCopy={() => selected && copyPath(selected.path)}
        onReanalyze={() => selected && postFileAction('/api/analyze', selected.path, { force: true }).then(() => setToast({ message: 'Analysis queued', type: 'success' }))}
      />
      {previewOpen && selected && <PreviewModal file={selected} onClose={() => setPreviewOpen(false)} />}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'error' ? <CircleAlert size={15} /> : <Check size={15} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function TypeFilter({ value, onChange }) {
  const options = TYPE_FILTERS.map((type) => ({
    value: type,
    label: type === 'all' ? 'All types' : type.toUpperCase(),
  }));
  return <Dropdown icon={<SlidersHorizontal size={14} />} value={value} options={options} onChange={onChange} label="Filter by file type" />;
}

function SortControl({ value, descending, onChange, onDirection }) {
  const options = SORT_OPTIONS.map(([key, label]) => ({ value: key, label: `Sort: ${label}` }));
  return (
    <div className="sort-control">
      <Dropdown value={value} options={options} onChange={onChange} label="Sort files" />
      <button onClick={onDirection} title={descending ? 'Descending' : 'Ascending'} aria-label={descending ? 'Descending' : 'Ascending'}>
        {descending ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
      </button>
    </div>
  );
}

function Dropdown({ icon, value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeWithEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeWithEscape, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeWithEscape, true);
    };
  }, []);

  return (
    <div className={`dropdown ${open ? 'open' : ''}`} ref={rootRef}>
      <button className="dropdown-trigger" onClick={() => setOpen((value) => !value)} aria-label={label} aria-expanded={open}>
        {icon}
        <span>{selected.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              className={option.value === value ? 'selected' : ''}
              onClick={() => { onChange(option.value); setOpen(false); }}
              role="menuitem"
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, activeFolder, onFolder, rootName, depth = 0 }) {
  const expandable = hasChildDirectories(node);
  const [open, setOpen] = useState(depth < 1 && expandable);
  if (node.type !== 'directory') return null;
  const label = depth === 0 ? rootName : node.name;
  return (
    <div>
      <div className={`tree-row ${activeFolder === node.path ? 'active' : ''}`} style={{ '--depth': depth }}>
        {expandable ? (
          <button
            className="tree-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            aria-expanded={open}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : <span className="tree-toggle-spacer" />}
        <button className="tree-folder" onClick={() => onFolder(node.path)} title={`Open ${label}`}>
          {expandable && open ? <FolderOpen size={16} /> : <Folder size={16} />}
          <span className="tree-label">{label}</span>
          <span className="tree-count">{node.fileCount || countNodeFiles(node)}</span>
        </button>
      </div>
      {expandable && open && node.children.filter((child) => child.type === 'directory').map((child) => (
        <TreeNode key={child.path} node={child} activeFolder={activeFolder} onFolder={onFolder} rootName={rootName} depth={depth + 1} />
      ))}
    </div>
  );
}

function FileCard({ file, index, view, selected, onSelect, onOpen }) {
  const preview = previewUrl(file);
  return (
    <article
      className={`file-card ${selected ? 'selected' : ''} ${file.status === 'error' ? 'has-error' : ''}`}
      style={{ '--delay': `${Math.min(index, 18) * 20}ms` }}
      onClick={onSelect}
      onDoubleClick={onOpen}
      tabIndex={0}
    >
      <div className="thumb">
        {preview ? <img src={preview} alt="" loading="lazy" /> : <FilePlaceholder file={file} />}
        {(file.status === 'processing' || file.status === 'queued') && <div className="processing"><LoaderCircle size={15} />Analyzing</div>}
        <span className={`type-badge kind-${file.kind}`}>{file.extension.slice(1) || 'FILE'}</span>
      </div>
      <div className="file-copy">
        <div className="file-name" title={file.name}>{file.name}</div>
        <FileSummary file={file} compact={view === 'grid'} />
      </div>
    </article>
  );
}

function FilePlaceholder({ file }) {
  const Icon = file.kind === 'pdf' || file.kind === 'text' ? FileText : file.kind === 'image' ? FileImage : file.kind === 'cad' ? Boxes : File;
  const label = file.kind === 'cad' ? 'CAD model' : file.kind === 'pdf' ? 'Drawing' : file.kind === 'text' ? 'Text document' : 'File';
  return <div className={`placeholder kind-${file.kind}`}><Icon size={38} strokeWidth={1.35} /><span>{label}</span></div>;
}

function FileSummary({ file, compact }) {
  const size = file.analysis?.metadata?.bounding_box?.size;
  if (size) return <span>{size.map(formatDimension).join(' × ')}</span>;
  if (file.kind === 'pdf' && file.analysis?.metadata?.pages) return <span>{file.analysis.metadata.pages} {file.analysis.metadata.pages === 1 ? 'page' : 'pages'}</span>;
  if (file.kind === 'text' && file.analysis?.metadata?.text) {
    const text = file.analysis.metadata.text;
    return <span>{number.format(text.lines)} lines · {number.format(text.words)} words</span>;
  }
  if (!compact) return <span>{formatBytes(file.size)} · {date.format(new Date(file.modifiedAt))}</span>;
  return <span>{formatBytes(file.size)}</span>;
}

function Inspector({ file, onClose, onPreview, onOpen, onReveal, onCopy, onReanalyze }) {
  if (!file) {
    return (
      <aside className="inspector empty-inspector">
        <div className="inspector-empty-mark"><Info size={20} /></div>
        <h2>File inspector</h2>
        <p>Select a file to inspect its preview, dimensions, geometry, and document metadata.</p>
        <div className="shortcut-list"><span>Navigate</span><kbd>Arrow keys</kbd><span>Open</span><kbd>O</kbd><span>Preview</span><kbd>Enter</kbd></div>
      </aside>
    );
  }
  const metadata = file.analysis?.metadata;
  const bbox = metadata?.bounding_box;
  const geometry = metadata?.geometry;
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <TypeIcon kind={file.kind} />
        <div className="inspector-title"><strong>{file.name}</strong><span title={file.path}>{file.path}</span></div>
        <button className="icon-button quiet" onClick={onClose} title="Close inspector"><X size={18} /></button>
      </div>

      <button className="inspector-preview" onClick={onPreview} disabled={!previewUrl(file)}>
        {previewUrl(file) ? <img src={previewUrl(file)} alt={`Preview of ${file.name}`} /> : <FilePlaceholder file={file} />}
      </button>

      <div className="inspector-actions">
        <button className="primary-action" onClick={onOpen}><ExternalLink size={16} />Open</button>
        <button onClick={onReveal}><FolderOpen size={16} />Reveal</button>
        <button onClick={onCopy} title="Copy project-relative path"><Copy size={16} /></button>
      </div>

      {file.status === 'error' && <div className="error-note">{file.error}</div>}
      {(file.status === 'queued' || file.status === 'processing') && <div className="analysis-note"><LoaderCircle size={16} />Extracting preview and metadata</div>}

      <InspectorSection title="File">
        <Property label="Type" value={(file.extension.slice(1) || 'file').toUpperCase()} />
        <Property label="Size" value={formatBytes(file.size)} />
        <Property label="Modified" value={date.format(new Date(file.modifiedAt))} />
        <Property label="Status" value={capitalize(file.status)} />
      </InspectorSection>

      {bbox && (
        <InspectorSection title="Bounding box">
          <div className="dimension-strip">
            {bbox.size.map((value, index) => <div key={index}><span>{['X', 'Y', 'Z'][index]}</span><strong>{formatDimension(value)}</strong></div>)}
          </div>
          <Vector label="Minimum" values={bbox.min} />
          <Vector label="Maximum" values={bbox.max} />
        </InspectorSection>
      )}

      {geometry && (
        <InspectorSection title="Geometry">
          <Property label="Meshes" value={number.format(geometry.mesh_count)} />
          <Property label="Vertices" value={number.format(geometry.vertex_count)} />
          <Property label="Triangles" value={number.format(geometry.triangle_count)} />
        </InspectorSection>
      )}

      {metadata?.materials && <Materials materials={metadata.materials} />}
      {metadata?.pages && (
        <InspectorSection title="Document">
          <Property label="Pages" value={metadata.pages} />
          {file.analysis?.text && <div className="text-preview">{file.analysis.text}</div>}
        </InspectorSection>
      )}
      {metadata?.text && (
        <InspectorSection title="Text">
          <Property label="Lines" value={number.format(metadata.text.lines)} />
          <Property label="Words" value={number.format(metadata.text.words)} />
          <Property label="Characters" value={number.format(metadata.text.characters)} />
          {metadata.text.truncated && <div className="text-limit-note">Showing the first 256 KB.</div>}
          {file.analysis?.text && <pre className="plain-text-preview">{file.analysis.text}</pre>}
        </InspectorSection>
      )}
      {file.analysis?.tree && <InspectorSection title="Model structure"><pre className="model-tree">{file.analysis.tree}</pre></InspectorSection>}

      <div className="inspector-footer">
        <button onClick={onReanalyze}><RefreshCw size={15} />Rebuild metadata and preview</button>
      </div>
    </aside>
  );
}

function InspectorSection({ title, children }) {
  return <section className="inspector-section"><h3>{title}</h3>{children}</section>;
}
function Property({ label, value }) {
  return <div className="property"><span>{label}</span><strong>{value}</strong></div>;
}
function Vector({ label, values }) {
  return <div className="vector"><span>{label}</span><code>[{values.map(formatDimension).join(', ')}]</code></div>;
}
function Materials({ materials }) {
  if (!materials.colors?.length && !materials.names?.length) return null;
  return (
    <InspectorSection title="Materials and colors">
      {materials.names?.map((name) => <div className="material-name" key={name}>{name}</div>)}
      <div className="swatches">
        {materials.colors?.map((color) => <div className="swatch" key={color.hex}><span style={{ background: color.hex }} /><code>{color.hex}</code><small>{color.faces} faces</small></div>)}
      </div>
    </InspectorSection>
  );
}

function PreviewModal({ file, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`}>
        <div className="modal-head"><div><strong>{file.name}</strong><span>{file.path}</span></div><button className="icon-button" onClick={onClose} title="Close preview"><X size={19} /></button></div>
        <div className="modal-canvas"><img src={previewUrl(file)} alt={`Preview of ${file.name}`} /></div>
      </div>
    </div>
  );
}

function TypeIcon({ kind }) {
  const Icon = kind === 'pdf' || kind === 'text' ? FileText : kind === 'image' ? FileImage : kind === 'cad' ? Boxes : File;
  return <span className={`type-icon kind-${kind}`}><Icon size={19} strokeWidth={1.7} /></span>;
}
function EmptyState({ query }) {
  return <div className="empty-state"><Search size={24} /><h2>No matching files</h2><p>{query ? 'Search checks names, paths, and extracted PDF text across the entire project.' : 'This folder is empty.'}</p></div>;
}
function LoadingScreen() {
  return <div className="loading-screen"><div className="brand-mark"><Box size={20} /></div><LoaderCircle size={18} /><span>Reading project files</span></div>;
}

function previewUrl(file) {
  if (file.analysis?.previewPath) return `/api/preview?path=${encodeURIComponent(file.analysis.previewPath.split(/[\\/]/).at(-1))}`;
  if (file.kind === 'image') return `/api/raw?path=${encodeURIComponent(file.path)}`;
  return null;
}
function countNodeFiles(node) {
  return node.children?.reduce((sum, child) => sum + (child.type === 'file' ? 1 : countNodeFiles(child)), 0) ?? 0;
}
function compareFiles(left, right, sortBy) {
  if (sortBy === 'modified') return new Date(left.modifiedAt) - new Date(right.modifiedAt);
  if (sortBy === 'size') return left.size - right.size;
  if (sortBy === 'type') return left.extension.localeCompare(right.extension) || left.name.localeCompare(right.name, undefined, { numeric: true });
  return left.name.localeCompare(right.name, undefined, { numeric: true });
}
function formatDimension(value) {
  return number.format(Number(value));
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${number.format(value)} ${unit}`;
}
function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : 'Unknown';
}
function densityFor(columns) {
  if (columns >= 12) return 'micro';
  if (columns >= 8) return 'compact';
  return 'comfortable';
}
function useStoredNumber(key, fallback, min, max) {
  const [value, setValue] = useState(() => {
    const saved = Number(globalThis.localStorage?.getItem(key));
    return Number.isInteger(saved) && saved >= min && saved <= max ? saved : fallback;
  });
  useEffect(() => globalThis.localStorage?.setItem(key, String(value)), [key, value]);
  return [value, setValue];
}
async function loadProject(setter) {
  const response = await fetch('/api/project');
  setter(await response.json());
}
async function postFileAction(endpoint, filePath, extra = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, ...extra }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? 'The file action failed');
  }
  return response.json();
}

createRoot(document.getElementById('root')).render(<App />);
