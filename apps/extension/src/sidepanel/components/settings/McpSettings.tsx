import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { McpServer, McpServerStatus } from '@sidekick/shared'
import {
  createMcpServer,
  deleteMcpServer,
  listMcpServers,
  reconnectMcpServer,
} from '@/lib/mcpClient'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { ConfirmDialog } from '@/sidepanel/components/chat/ConfirmDialog'
import { SettingsSection, ToggleRow } from './SettingsControls'

/**
 * Section "MCP server" trong drawer Settings (T-M2-08 — FR-TOOLS-01).
 *
 * MCP server là **tiến trình ngoài** cung cấp thêm tool cho model. Cấu hình
 * (lệnh · tham số · biến môi trường) lưu **phía server** (Postgres) →
 * server spawn tiến trình và đăng ký tool vào `ToolRegistry`.
 *
 * Tool MCP **mặc định cần duyệt** (`autoApprove = false`) → server dừng tool
 * chờ user bấm "Duyệt" trong `ToolCallBlock` (FR-TOOLS-04).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7 · docs/SYSTEM_DESIGN.md §7.27
 */

/** Trạng thái rỗng của form thêm server. */
interface FormState {
  /** Ten server. */
  name: string
  /** Lenh spawn. */
  command: string
  /** Tham so (moi dong 1 tham so). */
  args: string
  /** Bien moi truong (moi dong 1 cap KEY=VALUE). */
  env: string
  /** Cho phep chay tool khong can duyet. */
  autoApprove: boolean
}

/** Form rong. */
const EMPTY_FORM: FormState = {
  name: '',
  command: '',
  args: '',
  env: '',
  autoApprove: false,
}

/**
 * Tach danh sach dong thanh mang chuoi (bo dong rong).
 *
 * @param text - Text nhieu dong.
 * @returns Mang dong (khong rong).
 */
function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Chuyen danh sach `KEY=VALUE` thanh record.
 *
 * @param text - Text nhieu dong.
 * @returns Record bien moi truong.
 */
function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of splitLines(text)) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key.length === 0) continue
    env[key] = value
  }
  return env
}

export function McpSettings() {
  const { t } = useI18n()

  const [servers, setServers] = useState<McpServer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<McpServer | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setHasError(false)
    try {
      const response = await listMcpServers()
      setServers(response.items)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Them MCP server moi → server connect thu ngay. */
  const submit = useCallback(async (): Promise<void> => {
    const name = form.name.trim().toLowerCase()
    const command = form.command.trim()

    if (name.length === 0 || command.length === 0) {
      setHasError(true)
      return
    }

    setIsSubmitting(true)
    setHasError(false)
    try {
      const created = await createMcpServer({
        name,
        transport: 'stdio',
        command,
        args: splitLines(form.args),
        env: parseEnv(form.env),
        enabled: true,
        autoApprove: form.autoApprove,
      })
      setServers((prev) =>
        [...prev.filter((item) => item.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
      setForm(EMPTY_FORM)
      setIsFormOpen(false)
      toast.success(t('toast.mcpAdded', { name: created.name }))
    } catch {
      setHasError(true)
      toast.error(t('toast.mcpAddFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }, [form, t])

  /** Ket noi lai 1 MCP server. */
  const reconnect = useCallback(
    async (server: McpServer): Promise<void> => {
      setBusyId(server.id)
      try {
        const result = await reconnectMcpServer(server.id)
        await load()
        if (result.status === 'error') {
          toast.error(t('toast.mcpReconnectFailed'))
          return
        }
        toast.success(t('toast.mcpReconnected'))
      } catch {
        toast.error(t('toast.mcpReconnectFailed'))
      } finally {
        setBusyId(null)
      }
    },
    [load, t],
  )

  /** Xoa 1 MCP server (co confirm). */
  const remove = useCallback(
    async (server: McpServer): Promise<void> => {
      try {
        await deleteMcpServer(server.id)
        setServers((prev) => prev.filter((item) => item.id !== server.id))
        toast.success(t('toast.mcpDeleted'))
      } catch {
        toast.error(t('toast.mcpDeleteFailed'))
      } finally {
        setPendingDelete(null)
      }
    },
    [t],
  )

  return (
    <SettingsSection title={t('mcp.settings.title')} description={t('mcp.settings.description')}>
      {isLoading ? (
        <p
          className="flex items-center gap-1.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
          data-testid="mcp-settings-loading"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t('mcp.settings.status.connecting')}
        </p>
      ) : null}

      {!isLoading && servers.length === 0 ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
          data-testid="mcp-settings-empty"
        >
          {t('mcp.settings.empty')}
        </p>
      ) : null}

      <ul className="space-y-2" data-testid="mcp-settings-list">
        {servers.map((server) => (
          <li
            key={server.id}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-2 py-2"
            data-testid="mcp-server-item"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]"
                  data-testid="mcp-server-name"
                >
                  {server.name}
                </p>
                <p className="truncate text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                  {server.command}
                  {server.args.length > 0 ? ` ${server.args.join(' ')}` : ''}
                </p>
              </div>
              <McpStatusBadge status={server.status} />
            </div>

            <p
              className="mt-1 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
              data-testid="mcp-server-meta"
            >
              {t('mcp.settings.toolCount', { count: server.toolCount })}
              {server.autoApprove ? ` · ${t('mcp.settings.autoApprove')}` : ''}
            </p>

            {server.lastError !== undefined ? (
              <p
                className="mt-1 text-[length:var(--font-size-xs)] text-[var(--danger)]"
                data-testid="mcp-server-error"
              >
                {server.lastError}
              </p>
            ) : null}

            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void reconnect(server)
                }}
                disabled={busyId === server.id}
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-2 py-1 text-[length:var(--font-size-xs)] text-[var(--text-primary)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                data-testid="mcp-server-reconnect"
              >
                {busyId === server.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                )}
                {t('mcp.settings.reconnect')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(server)
                }}
                disabled={busyId === server.id}
                className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-2 py-1 text-[length:var(--font-size-xs)] text-[var(--danger)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                data-testid="mcp-server-remove"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                {t('mcp.settings.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {isFormOpen ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-2" data-testid="mcp-settings-form">
          <p className="text-[length:var(--font-size-xs)] font-semibold text-[var(--text-primary)]">
            {t('mcp.settings.formTitle')}
          </p>

          <div className="space-y-1">
            <label
              className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              htmlFor="mcp-form-name"
            >
              {t('mcp.settings.name')}
            </label>
            <input
              id="mcp-form-name"
              type="text"
              value={form.name}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }}
              placeholder="sample"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-name"
            />
            <p className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
              {t('mcp.settings.nameHint')}
            </p>
          </div>

          <div className="space-y-1">
            <label
              className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              htmlFor="mcp-form-command"
            >
              {t('mcp.settings.command')}
            </label>
            <input
              id="mcp-form-command"
              type="text"
              value={form.command}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, command: event.target.value }))
              }}
              placeholder="npx"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-command"
            />
            <p className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
              {t('mcp.settings.commandHint')}
            </p>
          </div>

          <div className="space-y-1">
            <label
              className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              htmlFor="mcp-form-args"
            >
              {t('mcp.settings.args')}
            </label>
            <textarea
              id="mcp-form-args"
              value={form.args}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, args: event.target.value }))
              }}
              rows={2}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-args"
            />
          </div>

          <div className="space-y-1">
            <label
              className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              htmlFor="mcp-form-env"
            >
              {t('mcp.settings.env')}
            </label>
            <textarea
              id="mcp-form-env"
              value={form.env}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, env: event.target.value }))
              }}
              rows={2}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-env"
            />
          </div>

          <ToggleRow
            label={t('mcp.settings.autoApprove')}
            description={t('mcp.settings.autoApproveDescription')}
            checked={form.autoApprove}
            onChange={(autoApprove) => {
              setForm((prev) => ({ ...prev, autoApprove }))
            }}
            testId="mcp-form-auto-approve"
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void submit()
              }}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-[length:var(--font-size-xs)] font-medium text-[var(--color-accent-contrast)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-submit"
            >
              {isSubmitting ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : null}
              {isSubmitting ? t('mcp.settings.submitting') : t('mcp.settings.submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM)
                setIsFormOpen(false)
              }}
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-[length:var(--font-size-xs)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              data-testid="mcp-form-cancel"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {!isFormOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsFormOpen(true)
          }}
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-[length:var(--font-size-xs)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="mcp-settings-add"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {t('mcp.settings.add')}
        </button>
      ) : null}

      {hasError ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
          data-testid="mcp-settings-error"
        >
          {t('mcp.settings.loadError')}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('mcp.settings.remove')}
        {...(pendingDelete === null
          ? {}
          : { description: t('mcp.settings.confirmDelete', { name: pendingDelete.name }) })}
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={async () => {
          if (pendingDelete !== null) await remove(pendingDelete)
        }}
      />
    </SettingsSection>
  )
}

/**
 * Badge trang thai ket noi cua 1 MCP server.
 *
 * @param props - Props cua badge.
 */
function McpStatusBadge({ status }: { status: McpServerStatus }) {
  const { t } = useI18n()

  const label = t(`mcp.settings.status.${status}` as 'mcp.settings.status.connected')
  const toneClass =
    status === 'connected'
      ? 'bg-[var(--success-subtle)] text-[var(--success)]'
      : status === 'error'
        ? 'bg-[var(--danger-subtle)] text-[var(--danger)]'
        : status === 'connecting'
          ? 'bg-[var(--warning-subtle)] text-[var(--warning)]'
          : 'bg-[var(--surface-sunken)] text-[var(--text-tertiary)]'

  return (
    <span
      className={`shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[length:var(--font-size-xs)] ${toneClass}`}
      data-testid="mcp-server-status"
    >
      {label}
    </span>
  )
}
