/** Explorador de arquivos do projeto (árvore de pastas e arquivos). */

import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { normalizePath, type ProjectFile } from '../studio/project';
import {
  ChevronIcon,
  FileCodeIcon,
  FileIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from './Icons';

interface TreeNode {
  kind: 'dir' | 'file';
  name: string;
  path: string;
  children?: TreeNode[];
}

export interface ExplorerProps {
  files: ProjectFile[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onCreate: (path: string) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (path: string) => void;
}

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode = { kind: 'dir', name: '', path: '', children: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      const children = current.children ?? (current.children = []);
      let next = children.find((child) => child.name === part && child.kind === (isLeaf ? 'file' : 'dir'));
      if (!next) {
        next = isLeaf
          ? { kind: 'file', name: part, path }
          : { kind: 'dir', name: part, path, children: [] };
        children.push(next);
      }
      current = next;
    });
  }
  const sort = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1));
    nodes.forEach((node) => node.children && sort(node.children));
  };
  sort(root.children ?? []);
  return root.children ?? [];
}

export function Explorer({
  files,
  activePath,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: ExplorerProps): JSX.Element {
  const { t } = useI18n();
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const toggle = (path: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const submitCreate = (): void => {
    let path = normalizePath(draft);
    if (!path) {
      setCreating(false);
      return;
    }
    const last = path.split('/').pop() ?? '';
    if (!last.includes('.')) path = `${path}.bubble`;
    if (!files.some((file) => file.path === path)) onCreate(path);
    setDraft('');
    setCreating(false);
  };

  const submitRename = (from: string): void => {
    const next = normalizePath(renameDraft);
    if (next && next !== from && !files.some((file) => file.path === next)) onRename(from, next);
    setRenaming(null);
  };

  const renderNode = (node: TreeNode, depth: number): JSX.Element => {
    const padding = 8 + depth * 12;

    if (node.kind === 'dir') {
      const open = !collapsed.has(node.path);
      return (
        <div key={node.path} className="tree-group">
          <button
            type="button"
            className="tree-row tree-row-dir"
            style={{ paddingInlineStart: padding }}
            onClick={() => toggle(node.path)}
            aria-expanded={open}
          >
            <ChevronIcon size={13} open={open} className="tree-chevron" />
            <FolderIcon size={14} className="tree-icon" />
            <span className="tree-label">{node.name}</span>
          </button>
          {open && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const isActive = node.path === activePath;
    if (renaming === node.path) {
      return (
        <div key={node.path} className="tree-row tree-row-editing" style={{ paddingInlineStart: padding }}>
          <input
            autoFocus
            className="inline-input"
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitRename(node.path);
              if (event.key === 'Escape') setRenaming(null);
            }}
            onBlur={() => setRenaming(null)}
            aria-label={t('common.rename')}
          />
        </div>
      );
    }

    const isBubble = node.path.endsWith('.bubble');
    return (
      <div
        key={node.path}
        className={`tree-row tree-row-file${isActive ? ' is-active' : ''}`}
        style={{ paddingInlineStart: padding }}
      >
        <button type="button" className="tree-file-button" onClick={() => onOpen(node.path)}>
          {isBubble ? <FileCodeIcon size={14} className="tree-icon" /> : <FileIcon size={14} className="tree-icon" />}
          <span className="tree-label">{node.name}</span>
        </button>
        <span className="tree-actions">
          <button
            type="button"
            className="icon-button"
            title={t('explorer.rename')}
            aria-label={t('explorer.rename')}
            onClick={() => {
              setRenaming(node.path);
              setRenameDraft(node.name);
            }}
          >
            <PencilIcon size={13} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={t('explorer.delete')}
            aria-label={t('explorer.delete')}
            onClick={() => {
              if (window.confirm(t('explorer.deleteConfirm', { name: node.name }))) onDelete(node.path);
            }}
          >
            <TrashIcon size={13} />
          </button>
        </span>
      </div>
    );
  };

  return (
    <section className="panel explorer">
      <header className="panel-header">
        <h2>{t('explorer.title')}</h2>
        <button
          type="button"
          className="icon-button"
          title={t('explorer.newFile')}
          aria-label={t('explorer.newFile')}
          onClick={() => {
            setCreating(true);
            setDraft('');
          }}
        >
          <PlusIcon size={15} />
        </button>
      </header>

      {creating && (
        <div className="tree-row tree-row-editing" style={{ paddingInlineStart: 8 }}>
          <input
            autoFocus
            className="inline-input"
            placeholder={t('explorer.namePlaceholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitCreate();
              if (event.key === 'Escape') setCreating(false);
            }}
            onBlur={submitCreate}
            aria-label={t('explorer.newFile')}
          />
        </div>
      )}

      <div className="tree">
        {tree.length === 0 && <p className="empty-hint">{t('explorer.noFiles')}</p>}
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </section>
  );
}
