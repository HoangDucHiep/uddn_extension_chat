/**
 * Helper xu ly anh dinh kem tu may (FR-VISION-01 — T-M1-24).
 *
 * Ho tro 3 duong vao:
 *  - paste tu clipboard
 *  - drag & drop vao composer
 *  - file picker
 *
 * Tất cả deu quy ve `File` → validate → doc base64.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.4
 */

import {
  ERROR_CODES,
  IMAGE_MIME_TYPES,
  VISION,
  type ImageAttachment,
  type ImageMimeType,
} from '@sidekick/shared'

/** Ket qua validate mot file anh. */
export type ImageValidationResult =
  | { ok: true; mimeType: ImageMimeType }
  | { ok: false; code: string; message: string }

/**
 * Kiem tra file co phai dinh dang anh duoc phep khong.
 *
 * Khong bao gio throw — tra ve error code de UI hien thi thong bao.
 *
 * @param file - File can kiem tra.
 */
export function validateImageFile(file: File): ImageValidationResult {
  const mimeType = file.type as ImageMimeType

  if (!IMAGE_MIME_TYPES.includes(mimeType)) {
    return {
      ok: false,
      code: ERROR_CODES.VISION_UNSUPPORTED_TYPE,
      message: `Định dạng "${file.type || 'không rõ'}" không được hỗ trợ. Chỉ nhận PNG, JPEG, WEBP, GIF.`,
    }
  }

  if (file.size > VISION.MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: ERROR_CODES.VISION_IMAGE_TOO_LARGE,
      message: `Ảnh vượt quá ${formatBytes(VISION.MAX_IMAGE_BYTES)}. Hãy chọn ảnh nhỏ hơn.`,
    }
  }

  if (file.size === 0) {
    return {
      ok: false,
      code: ERROR_CODES.VISION_UNSUPPORTED_TYPE,
      message: 'Ảnh rỗng — không thể đính kèm.',
    }
  }

  return { ok: true, mimeType }
}

/**
 * Doc file thanh `ImageAttachment` (base64 thuan).
 *
 * Dung `FileReader` de doc binary → base64. Khong dung `readAsDataURL`
 * de tranh phai cat prefix `data:<mime>;base64,` (server can base64 thuan).
 *
 * @param file - File anh.
 */
export function readImageFile(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = (): void => {
      reject(new Error('Không đọc được tệp ảnh.'))
    }

    reader.onload = (): void => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Không đọc được tệp ảnh.'))
        return
      }

      const data = stripDataUrlPrefix(result)
      const mimeType = file.type as ImageMimeType

      resolve({
        id: createAttachmentId(),
        mimeType,
        data,
        bytes: file.size,
        ...(file.name.length > 0 ? { fileName: file.name } : {}),
      })
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Do kich thuoc pixel cua anh (dung cho preview).
 *
 * Uu tien `createImageBitmap` (nhanh, khong can DOM), fallback ve `Image`
 * (trinh duyet cu). Neu ca hai deu that bai → tra `undefined` (anh van
 * dinh kem duoc, chi khong co kich thuoc de hien thi).
 *
 * @param file - File anh.
 */
export async function measureImage(
  file: File,
): Promise<{ width: number; height: number } | undefined> {
  try {
    return await measureImageUnsafe(file)
  } catch {
    // Anh van dinh kem duoc — chi khong co kich thuoc de hien thi preview.
    return undefined
  }
}

/**
 * Do kich thuoc pixel (phan loi — ham nay co the throw).
 */
async function measureImageUnsafe(
  file: File,
): Promise<{ width: number; height: number } | undefined> {
  const bitmapApi = globalThis.createImageBitmap
  if (typeof bitmapApi === 'function') {
    try {
      // Gọi trực tiếp (không `.call`) để giữ đúng overload của lib.dom.
      const bitmap = await bitmapApi(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return size
    } catch {
      // Tiep tuc thu fallback bang `Image`.
    }
  }

  if (
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return undefined
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = (): void => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = (): void => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    img.src = url
  })
}

/**
 * Cat prefix `data:<mime>;base64,` khoi chuoi data URL.
 *
 * @param dataUrl - Chuoi data URL day du.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const separatorIndex = dataUrl.indexOf(',')
  if (separatorIndex === -1) return dataUrl
  if (!dataUrl.slice(0, separatorIndex).startsWith('data:')) return dataUrl
  return dataUrl.slice(separatorIndex + 1)
}

/**
 * Lay cac file anh tu `DataTransfer` (paste hoac drop).
 *
 * Chi lay item dang file va co MIME bat dau bang `image/`.
 *
 * @param dataTransfer - DataTransfer cua su kien paste/drop.
 */
export function extractImagesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (dataTransfer === null) return []

  const files: File[] = []

  // `items` cho biet co phai la file hay chuoi text.
  if (dataTransfer.items !== undefined && dataTransfer.items.length > 0) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file === null) continue
      if (!file.type.startsWith('image/')) continue
      files.push(file)
    }
    if (files.length > 0) return files
  }

  // Fallback cho browser khong ho tro `items`.
  if (dataTransfer.files !== undefined) {
    for (const file of Array.from(dataTransfer.files)) {
      if (!file.type.startsWith('image/')) continue
      files.push(file)
    }
  }

  return files
}

/**
 * Lay cac file anh tu clipboard (su kien paste).
 *
 * Wrapper cua `extractImagesFromDataTransfer` — tach rieng de caller
 * (Composer) doc ro muc dich.
 *
 * @param dataTransfer - DataTransfer cua su kien paste.
 */
export function extractImagesFromClipboard(dataTransfer: DataTransfer | null): File[] {
  return extractImagesFromDataTransfer(dataTransfer)
}

/**
 * Lay cac file anh tu drag & drop.
 *
 * Wrapper cua `extractImagesFromDataTransfer` — tach rieng de caller
 * (Composer) doc ro muc dich.
 *
 * @param dataTransfer - DataTransfer cua su kien drop.
 */
export function extractImagesFromDrop(dataTransfer: DataTransfer | null): File[] {
  return extractImagesFromDataTransfer(dataTransfer)
}

/**
 * Tao id cho mot anh dinh kem.
 *
 * Dung `crypto.randomUUID()` khi co; fallback sang UUID v4 tu sinh de
 * luon khop `imageAttachmentSchema` (id phai la uuid).
 */
export function createAttachmentId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${randomHex(4)}-${randomHex(12)}`
}

/** Sinh chuoi hex ngau nhien co do dai cho truoc. */
function randomHex(length: number): string {
  let out = ''
  for (let index = 0; index < length; index += 1) {
    out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

/**
 * Do kich thuoc byte choi doc.
 *
 * @param bytes - So byte.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
