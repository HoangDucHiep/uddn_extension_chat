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
})

describe('Composer — dinh kem anh', () => {
  /** Render composer voi callback dinh kem anh. */
  function renderComposer(onImagesSelected: (files: readonly File[]) => void) {
    return render(
      <Composer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
        onImagesSelected={onImagesSelected}
      />,
    )
  }

  it('co nut dinh kem anh khi handler duoc truyen', () => {
    renderComposer(vi.fn())

    expect(screen.getByTestId('composer-image-button')).toBeDefined()
    expect(screen.getByTestId('composer-file-input')).toBeDefined()
  })

  it('khong co nut dinh kem anh khi khong truyen handler', () => {
    render(
      <Composer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
      />,
    )

    expect(screen.queryByTestId('composer-image-button')).toBeNull()
  })

  it('file picker gui file da chon', () => {
    const onImagesSelected = vi.fn()
    renderComposer(onImagesSelected)

    const input = screen.getByTestId('composer-file-input') as HTMLInputElement
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })

    fireEvent.change(input)

    expect(onImagesSelected).toHaveBeenCalledTimes(1)
    expect(onImagesSelected.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('paste anh → gui file, chan hanh dong mac dinh', () => {
    const onImagesSelected = vi.fn()
    renderComposer(onImagesSelected)

    const input = screen.getByTestId('composer-input')
    const file = new File(['x'], 'a.png', { type: 'image/png' })

    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [file] },
    })
    input.dispatchEvent(event)

    expect(onImagesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('paste text thuong → KHONG goi handler, KHONG chan', () => {
    const onImagesSelected = vi.fn()
    renderComposer(onImagesSelected)

    const input = screen.getByTestId('composer-input')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [] },
    })
    input.dispatchEvent(event)

    expect(onImagesSelected).not.toHaveBeenCalled()
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
    const onImagesSelected = vi.fn()
    renderComposer(onImagesSelected)

    const composer = screen.getByTestId('composer')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file] },
    })
    composer.dispatchEvent(event)

    expect(onImagesSelected).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('drop file khong phai anh → khong gui', () => {
    const onImagesSelected = vi.fn()
    renderComposer(onImagesSelected)

    const composer = screen.getByTestId('composer')
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file] },
    })
    composer.dispatchEvent(event)

    expect(onImagesSelected).not.toHaveBeenCalled()
  })
})
