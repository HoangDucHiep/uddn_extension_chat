import { useCallback, useMemo, useState } from 'react'
import { DOCUMENT, ERROR_CODES, type ContextItem } from '@sidekick/shared'
import {
  requestDocumentExtract,
  validateDocumentFile,
} from '@/lib/documentUpload'
import { createAttachmentId } from '@/lib/imageUpload'
import { useChatStore } from '../store/chatStore'
import { useI18n } from './useI18n'

/**
 * Hook quan ly tai lieu dinh kem (FR-CONTEXT-14 — T-M2-23).
 *
 * Tai lieu duoc them tu 3 nguon: paste · drag-drop · file picker — deu quy ve
 * `File` → validate → doc base64 → gui BFF parse → tao `ContextItem`
 * voi `kind: 'file'` + `tier: 'attachment'`.
 *
 * KHONG luu DB (quyet dinh "no-persist") → tai lieu chi song trong phien
 * panel hien tai; dong panel la mat.
 */

/** Loi khi xu ly tai lieu that bai. */
export interface DocumentAttachmentError {
  code: string
  message: string
}

export interface UseDocumentAttachmentsResult {
  /** Loi gan nhat (neu co). */
  error: DocumentAttachmentError | undefined
  /** Dang doc/parse file → disable nut. */
  isReading: boolean
  /** Them file(s) — tu dong validate + parse + dinh kem vao context. */
  addFiles: (files: readonly File[]) => Promise<void>
  /** Xoa loi. */
  clearError: () => void
}

export function useDocumentAttachments(): UseDocumentAttachmentsResult {
  const { t } = useI18n()
  const attachItem = useChatStore((state) => state.attachItem)
  const setContextError = useChatStore((state) => state.setContextError)

  const [error, setError] = useState<DocumentAttachmentError | undefined>(undefined)
  const [isReading, setIsReading] = useState(false)

  const clearError = useCallback(() => {
    setError(undefined)
  }, [])

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return

      setIsReading(true)
      const current = useChatStore.getState().attachedItems
      const documentCount = current.filter((item) => item.kind === 'file').length
      const remaining = DOCUMENT.MAX_PER_MESSAGE - documentCount

      if (remaining <= 0) {
        setError({
          code: ERROR_CODES.DOCUMENT_TOO_LARGE,
          message: t('document.tooMany', { count: DOCUMENT.MAX_PER_MESSAGE }),
        })
        setIsReading(false)
        return
      }

      let accepted = 0

      try {
        for (const file of files) {
          if (accepted >= remaining) {
            setError({
              code: ERROR_CODES.DOCUMENT_TOO_LARGE,
              message: t('document.tooMany', { count: DOCUMENT.MAX_PER_MESSAGE }),
            })
            break
          }

          const validation = validateDocumentFile(file)
          if (!validation.ok) {
            setError({ code: validation.code, message: validation.message })
            setContextError({ error: validation.code, message: validation.message })
            continue
          }

          const outcome = await requestDocumentExtract(file)

          if (outcome.error !== undefined || outcome.text.length === 0) {
            const code = outcome.error ?? ERROR_CODES.DOCUMENT_EMPTY
            const message = outcome.errorMessage ?? t('document.notReadable', { name: file.name })
            setError({ code, message })
            setContextError({ error: code, message })
            continue
          }

          const item: ContextItem = {
            id: `doc-${createAttachmentId()}`,
            kind: 'file',
            tier: 'attachment',
            title: file.name,
            text: outcome.text,
            ...(outcome.excerpt !== undefined ? { excerpt: outcome.excerpt } : {}),
            fileName: file.name,
            ...(file.type.length > 0 ? { mimeType: file.type } : {}),
          }

          attachItem(item)
          accepted += 1
        }
      } finally {
        setIsReading(false)
      }
    },
    [attachItem, setContextError, t],
  )

  return useMemo(
    () => ({
      error,
      isReading,
      addFiles,
      clearError,
    }),
    [error, isReading, addFiles, clearError],
  )
}
