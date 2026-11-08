import { useCallback, useMemo, useState } from 'react'
import {
  ERROR_CODES,
  VISION,
  type ImageAttachment,
} from '@sidekick/shared'
import {
  measureImage,
  readImageFile,
  validateImageFile,
} from '@/lib/imageUpload'
import { useChatStore } from '../store/chatStore'
import { useI18n } from './useI18n'

/**
 * Hook quan ly anh cho san (FR-VISION-01 — T-M1-24).
 *
 * Anh duoc them tu 3 nguon: paste · drag-drop · file picker — deu quy ve
 * `File` → validate → doc base64.
 *
 * KHONG dung `contextEnabled` — anh la dau vao truc tiep cua cau hoi.
 */

/** Loi khi xu ly anh that bai. */
export interface ImageAttachmentError {
  code: string
  message: string
}

export interface UseImageAttachmentsResult {
  /** Anh cho san (chua gui). */
  images: readonly ImageAttachment[]
  /** Loi gan nhat (neu co). */
  error: ImageAttachmentError | undefined
  /** Dang doc file → disable nut. */
  isReading: boolean
  /** Them file(s) — tu dong validate + doc base64. */
  addFiles: (files: readonly File[]) => Promise<void>
  /** Xoa mot anh theo id. */
  removeImage: (id: string) => void
  /** Xoa tat ca anh. */
  clearImages: () => void
  /** Xoa loi. */
  clearError: () => void
}

export function useImageAttachments(): UseImageAttachmentsResult {
  const { t } = useI18n()
  const images = useChatStore((state) => state.pendingImages)
  const addPendingImages = useChatStore((state) => state.addPendingImages)
  const removePendingImage = useChatStore((state) => state.removePendingImage)
  const clearPendingImages = useChatStore((state) => state.clearPendingImages)

  const [error, setError] = useState<ImageAttachmentError | undefined>(undefined)
  const [isReading, setIsReading] = useState(false)

  const clearError = useCallback(() => {
    setError(undefined)
  }, [])

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return

      setIsReading(true)
      const current = useChatStore.getState().pendingImages

      // Cho phep them toi da VISION.MAX_IMAGES_PER_MESSAGE anh.
      const remaining = VISION.MAX_IMAGES_PER_MESSAGE - current.length
      if (remaining <= 0) {
        setError({
          code: ERROR_CODES.VISION_TOO_MANY_IMAGES,
          message: t('vision.tooManyImages', { count: VISION.MAX_IMAGES_PER_MESSAGE }),
        })
        setIsReading(false)
        return
      }

      const accepted: ImageAttachment[] = []
      let totalBytes = current.reduce((sum, image) => sum + image.bytes, 0)

      try {
        for (const file of files) {
          if (accepted.length >= remaining) {
            setError({
              code: ERROR_CODES.VISION_TOO_MANY_IMAGES,
              message: t('vision.tooManyImages', { count: VISION.MAX_IMAGES_PER_MESSAGE }),
            })
            break
          }

          const validation = validateImageFile(file)
          if (!validation.ok) {
            setError({ code: validation.code, message: validation.message })
            continue
          }

          if (totalBytes + file.size > VISION.MAX_TOTAL_IMAGE_BYTES) {
            setError({
              code: ERROR_CODES.VISION_TOTAL_TOO_LARGE,
              message: t('vision.totalTooLarge'),
            })
            break
          }

          try {
            const attachment = await readImageFile(file)
            // Kich thuoc pixel chi dung cho preview → that bai khong chan
            // viec dinh kem anh.
            const size = await measureImage(file)
            accepted.push({
              ...attachment,
              ...(size !== undefined ? { width: size.width, height: size.height } : {}),
            })
            totalBytes += file.size
          } catch {
            setError({
              code: ERROR_CODES.VISION_UNSUPPORTED_TYPE,
              message: t('vision.unsupportedType', { name: file.name || 'ảnh' }),
            })
          }
        }
      } finally {
        setIsReading(false)
      }

      if (accepted.length > 0) {
        addPendingImages(accepted)
      }
    },
    [addPendingImages, t],
  )

  const removeImage = useCallback(
    (id: string) => {
      removePendingImage(id)
    },
    [removePendingImage],
  )

  const clearImages = useCallback(() => {
    clearPendingImages()
  }, [clearPendingImages])

  return useMemo(
    () => ({
      images,
      error,
      isReading,
      addFiles,
      removeImage,
      clearImages,
      clearError,
    }),
    [images, error, isReading, addFiles, removeImage, clearImages, clearError],
  )
}
