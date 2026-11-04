import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, type ChatMessage } from '../src/sidepanel/store/chatStore'

/**
 * Unit test cho Zustand store cua side panel.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §7 (state)
 */

const userMessage: ChatMessage = {
  id: 'user-1',
  role: 'user',
  content: 'Xin chao',
  createdAt: 1_700_000_000_000,
  status: 'done',
}

beforeEach(() => {
  useChatStore.getState().reset()
})

describe('useChatStore', () => {
  it('bat dau voi state rong', () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.conversationId).toBeUndefined()
  })

  it('addMessage them message vao cuoi', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().addMessage({ ...userMessage, id: 'assistant-1', role: 'assistant' })
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['user-1', 'assistant-1'])
  })

  it('appendToMessage noi noi dung vao message dung id', () => {
    useChatStore.getState().addMessage({ ...userMessage, id: 'a1', role: 'assistant', content: '' })
    useChatStore.getState().appendToMessage('a1', 'Xin')
    useChatStore.getState().appendToMessage('a1', ' chao')
    const message = useChatStore.getState().messages[0]
    expect(message?.content).toBe('Xin chao')
  })

  it('appendToMessage khong tao message moi khi id khong ton tai', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().appendToMessage('khong-ton-tai', 'abc')
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0]?.content).toBe('Xin chao')
  })

  it('updateMessage patch cac truong', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().updateMessage('user-1', { status: 'error', errorMessage: 'Loi' })
    const message = useChatStore.getState().messages[0]
    expect(message?.status).toBe('error')
    expect(message?.errorMessage).toBe('Loi')
  })

  it('setActive luu provider/model/keySource', () => {
    useChatStore.getState().setActive({ provider: 'groq', model: 'gpt-oss', keySource: 'K1' })
    const state = useChatStore.getState()
    expect(state.activeProvider).toBe('groq')
    expect(state.activeModel).toBe('gpt-oss')
    expect(state.keySource).toBe('K1')
  })

  it('setActive voi gia tri undefined xoa thong tin cu', () => {
    useChatStore.getState().setActive({ provider: 'groq' })
    useChatStore.getState().setActive({ provider: undefined })
    expect(useChatStore.getState().activeProvider).toBeUndefined()
  })

  it('reset xoa toan bo state', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().setConversationId('conv-1')
    useChatStore.getState().setStreaming(true)
    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.conversationId).toBeUndefined()
    expect(state.isStreaming).toBe(false)
  })
})
