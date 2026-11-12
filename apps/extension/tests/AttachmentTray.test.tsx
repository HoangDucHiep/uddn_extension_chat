import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AttachmentTray } from '../src/sidepanel/components/composer/AttachmentTray.js'
import { Composer } from '../src/sidepanel/components/Composer.js'
import type { ImageAttachment } from '@sidekick/shared'

/**
 * Unit test cho UI dinh kem anh (FR-VISION-01 — T-M1-24).
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

const image: ImageAttachment = {
  id: '11111111-2222-4333-8444-555555555555',
  mimeType: 'image/png',
  data: 'aGVsbG8=',
  bytes: 5,
  fileName: 'anh.png',
}

describe('AttachmentTray', () => {
  it('khong render khi khong co anh va khong co loi', () => {
    const { container } = render(
      <AttachmentTray images={[]} onRemove={vi.fn()} errorMessage={undefined} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('hien thi thumbnail cho moi anh', () => {
    render(<AttachmentTray images={[image]} onRemove={vi.fn()} errorMessage={undefined} />)

    const thumbs = screen.getAllByTestId('attachment-thumb')
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]?.getAttribute('data-image-id')).toBe(image.id)
  })

  it('img dung data url base64', () => {
    const { container } = render(
      <AttachmentTray images={[image]} onRemove={vi.fn()} errorMessage={undefined} />,
    )

    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,aGVsbG8=')
  })

  it('goi onRemove voi id dung', () => {
    const onRemove = vi.fn()
    render(<AttachmentTray images={[image]} onRemove={onRemove} errorMessage={undefined} />)

    fireEvent.click(screen.getByLabelText('Xoá ảnh đính kèm anh.png'))

    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith(image.id)
  })

  it('hien thi loi khi co errorMessage', () => {
    render(
      <AttachmentTray images={[]} onRemove={vi.fn()} errorMessage="Anh qua lon" />,
    )

    expect(screen.getByTestId('attachment-error').textContent).toContain('Anh qua lon')
  })

  it('hien thi so anh va token uoc luong', () => {
    render(<AttachmentTray images={[image]} onRemove={vi.fn()} errorMessage={undefined} />)

    const tray = screen.getByTestId('attachment-tray')
    expect(tray.textContent).toContain('1 ảnh')
  })

  // --- FR-CONTEXT-14 — tai lieu dinh kem (T-M2-23) ---

  it('hien thi danh sach tai lieu', () => {
    render(
      <AttachmentTray
        images={[]}
        onRemove={vi.fn()}
        errorMessage={undefined}
        documents={[{ id: 'doc-1', title: 'bao-cao.pdf', excerpt: 'trich dan' }]}
      />,
    )

    const items = screen.getAllByTestId('document-item')
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toContain('bao-cao.pdf')
  })

  it('goi onRemoveDocument voi id dung', () => {
    const onRemoveDocument = vi.fn()
    render(
      <AttachmentTray
        images={[]}
        onRemove={vi.fn()}
        errorMessage={undefined}
        documents={[{ id: 'doc-1', title: 'bao-cao.pdf', excerpt: undefined }]}
        onRemoveDocument={onRemoveDocument}
      />,
    )

    fireEvent.click(screen.getByLabelText('Xoa context bao-cao.pdf'))

    expect(onRemoveDocument).toHaveBeenCalledWith('doc-1')
  })

  it('render tray khi chi co tai lieu (khong co anh)', () => {
    render(
      <AttachmentTray
        images={[]}
        onRemove={vi.fn()}
        errorMessage={undefined}
        documents={[{ id: 'doc-1', title: 'a.txt', excerpt: undefined }]}
      />,
    )

    expect(screen.getByTestId('attachment-tray')).toBeDefined()
  })
})

describe('Composer — dinh kem file (anh + tai lieu)', () => {
  /** Render composer voi callback dinh kem file. */
  function renderComposer(onFilesSelected: (files: readonly File[]) => void) {
    return render(
      <Composer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
        onFilesSelected={onFilesSelected}
      />,
    )
  }

  it('co nut dinh kem file khi handler duoc truyen', () => {
    renderComposer(vi.fn())

    expect(screen.getByTestId('composer-file-button')).toBeDefined()
    expect(screen.getByTestId('composer-file-input')).toBeDefined()
  })

  it('file picker chap nhan ca dinh dang tai lieu', () => {
    renderComposer(vi.fn())

    const input = screen.getByTestId('composer-file-input') as HTMLInputElement
    expect(input.getAttribute('accept')).toContain('.pdf')
    expect(input.getAttribute('accept')).toContain('.docx')
    expect(input.getAttribute('accept')).toContain('.txt')
  })

  it('khong co nut dinh kem file khi khong truyen handler', () => {
    render(
      <Composer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
      />,
    )

    expect(screen.queryByTestId('composer-file-button')).toBeNull()
  })

  it('file picker gui file da chon', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const input = screen.getByTestId('composer-file-input') as HTMLInputElement
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })

    fireEvent.change(input)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(onFilesSelected.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('file picker gui ca tai lieu (khong phai anh)', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const input = screen.getByTestId('composer-file-input') as HTMLInputElement
    const file = new File(['x'], 'bao-cao.pdf', { type: 'application/pdf' })
    Object.defineProperty(input, 'files', { value: [file] })

    fireEvent.change(input)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(onFilesSelected.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('paste anh → gui file, chan hanh dong mac dinh', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const input = screen.getByTestId('composer-input')
    const file = new File(['x'], 'a.png', { type: 'image/png' })

    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [file] },
    })
    input.dispatchEvent(event)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('paste tai lieu → gui file', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const input = screen.getByTestId('composer-input')
    const file = new File(['x'], 'ghi-chu.txt', { type: 'text/plain' })

    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [file] },
    })
    input.dispatchEvent(event)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('paste text thuong → KHONG goi handler, KHONG chan', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const input = screen.getByTestId('composer-input')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [] },
    })
    input.dispatchEvent(event)

    expect(onFilesSelected).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('drag-over → chan hanh dong mac dinh (khong dieu huong panel)', () => {
    renderComposer(vi.fn())

    const composer = screen.getByTestId('composer')
    const event = new Event('dragover', { bubbles: true, cancelable: true })
    composer.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('drop anh → gui file', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const composer = screen.getByTestId('composer')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file] },
    })
    composer.dispatchEvent(event)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('drop tai lieu → gui file (FR-CONTEXT-14)', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const composer = screen.getByTestId('composer')
    const file = new File(['x'], 'bao-cao.pdf', { type: 'application/pdf' })
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file] },
    })
    composer.dispatchEvent(event)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('drop file khong ho tro → khong gui', () => {
    const onFilesSelected = vi.fn()
    renderComposer(onFilesSelected)

    const composer = screen.getByTestId('composer')
    const file = new File(['x'], 'a.exe', { type: 'application/octet-stream' })
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file] },
    })
    composer.dispatchEvent(event)

    expect(onFilesSelected).not.toHaveBeenCalled()
  })
})
