import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import type * as EngineGen from '@/constants/rpc'
import {findLast} from '@/util/arrays'
import {registerDebugClear} from '@/util/debug'
import {useCurrentUserState} from '@/stores/current-user'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'

type ConversationInputStore = T.Immutable<{
  commandMarkdown?: T.RPCChat.UICommandMarkdown
  commandStatus?: T.Chat.CommandStatusInfo
  editing: T.Chat.Ordinal
  giphyResult?: T.RPCChat.GiphySearchResults
  giphyWindow: boolean
  replyTo: T.Chat.Ordinal
  unsentText?: string
}>

export interface ConversationInputState extends ConversationInputStore {
  dispatch: {
    injectIntoInput: (text?: string) => void
    resetState: () => void
    sendComposerText: (text: string) => void
    sendGiphyResult: (result: T.RPCChat.GiphySearchResult) => void
    setCommandMarkdown: (md?: T.RPCChat.UICommandMarkdown) => void
    setCommandStatusInfo: (info?: T.Chat.CommandStatusInfo) => void
    setEditing: (ordinal: T.Chat.Ordinal | 'last' | 'clear') => void
    setGiphyResult: (result?: T.RPCChat.GiphySearchResults) => void
    setGiphyWindow: (show: boolean) => void
    setReplyTo: (ordinal: T.Chat.Ordinal) => void
    toggleGiphyPrefill: () => void
  }
}

const emptyOrdinal = T.Chat.numberToOrdinal(0)

const initialConversationInputStore: ConversationInputStore = {
  commandMarkdown: undefined,
  commandStatus: undefined,
  editing: emptyOrdinal,
  giphyResult: undefined,
  giphyWindow: false,
  replyTo: emptyOrdinal,
  unsentText: undefined,
}

type MadeStore = UseBoundStore<StoreApi<ConversationInputState>>

declare global {
  var __hmr_conversationInputStores: Map<T.Chat.ConversationIDKey, MadeStore> | undefined
}

const conversationInputStores: Map<T.Chat.ConversationIDKey, MadeStore> = __DEV__
  ? (globalThis.__hmr_conversationInputStores ??= new Map())
  : new Map()

const createConversationInputSlice =
  (conversationIDKey: T.Chat.ConversationIDKey): Z.ImmerStateCreator<ConversationInputState> =>
  (set, get) => ({
    ...initialConversationInputStore,
    dispatch: {
      injectIntoInput: text => {
        set(s => {
          s.unsentText = text
        })
      },
      resetState: Z.defaultReset,
      sendComposerText: text => {
        const {editing, replyTo} = get()
        ConvoState.getConvoState(conversationIDKey).dispatch.sendMessage(text, {
          editingOrdinal: editing,
          onRestoreText: restoredText =>
            getConversationInputState(conversationIDKey).dispatch.injectIntoInput(restoredText),
          replyToOrdinal: replyTo,
        })
        set(s => {
          s.commandMarkdown = undefined
          s.editing = emptyOrdinal
          s.giphyWindow = false
          s.replyTo = emptyOrdinal
          s.unsentText = ''
        })
      },
      sendGiphyResult: result => {
        ConvoState.getConvoState(conversationIDKey).dispatch.giphySend(result, {replyToOrdinal: get().replyTo})
        set(s => {
          s.commandMarkdown = undefined
          s.giphyWindow = false
          s.replyTo = emptyOrdinal
          s.unsentText = ''
        })
      },
      setCommandMarkdown: md => {
        set(s => {
          s.commandMarkdown = md ? T.castDraft(md) : undefined
        })
      },
      setCommandStatusInfo: info => {
        set(s => {
          s.commandStatus = info ? T.castDraft(info) : undefined
        })
      },
      setEditing: e => {
        if (e === 'clear') {
          set(s => {
            s.editing = emptyOrdinal
            s.unsentText = ''
          })
          return
        }

        const {messageMap, messageOrdinals} = ConvoState.getConvoState(conversationIDKey)
        let ordinal = emptyOrdinal
        if (e === 'last') {
          const editLastUser = useCurrentUserState.getState().username
          const found =
            !!messageOrdinals &&
            findLast(messageOrdinals, o => {
              const message = messageMap.get(o)
              return !!(
                (message?.type === 'text' || message?.type === 'attachment') &&
                message.author === editLastUser &&
                !message.exploded &&
                message.isEditable
              )
            })
          if (!found) return
          ordinal = found
        } else {
          ordinal = e
        }

        if (!ordinal) return
        const message = messageMap.get(ordinal)
        if (message?.type === 'text' || message?.type === 'attachment') {
          set(s => {
            s.editing = ordinal
            s.unsentText = message.type === 'text' ? message.text.stringValue() : message.title
          })
        }
      },
      setGiphyResult: result => {
        set(s => {
          s.giphyResult = result ? T.castDraft(result) : undefined
        })
      },
      setGiphyWindow: show => {
        set(s => {
          s.giphyWindow = show
        })
      },
      setReplyTo: ordinal => {
        set(s => {
          s.replyTo = ordinal
        })
      },
      toggleGiphyPrefill: () => {
        const shouldClear = get().giphyWindow
        set(s => {
          s.unsentText = shouldClear ? '' : '/giphy '
        })
      },
    },
  })

const createConversationInputStore = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const existing = conversationInputStores.get(conversationIDKey)
  if (existing) return existing
  const next = Z.createZustand<ConversationInputState>(createConversationInputSlice(conversationIDKey))
  conversationInputStores.set(conversationIDKey, next)
  return next
}

const clearConversationInputStores = () => {
  conversationInputStores.clear()
}

registerDebugClear(() => {
  clearConversationInputStores()
})

Z.registerExternalResetter('conversation-input', clearConversationInputStores)

const getConversationInputState = (conversationIDKey: T.Chat.ConversationIDKey) => {
  return createConversationInputStore(conversationIDKey).getState()
}

export const injectConversationInputText = (conversationIDKey: T.Chat.ConversationIDKey, text?: string) => {
  getConversationInputState(conversationIDKey).dispatch.injectIntoInput(text)
}

export const setConversationInputCommandStatus = (
  conversationIDKey: T.Chat.ConversationIDKey,
  info?: T.Chat.CommandStatusInfo
) => {
  getConversationInputState(conversationIDKey).dispatch.setCommandStatusInfo(info)
}

export const onConversationInputEngineAction = (action: EngineGen.Actions) => {
  switch (action.type) {
    case 'chat.1.chatUi.chatCommandStatus': {
      const {actions, convID, displayText, typ} = action.payload.params
      setConversationInputCommandStatus(T.Chat.stringToConversationIDKey(convID), {
        actions: T.castDraft(actions) || [],
        displayText,
        displayType: typ,
      })
      break
    }
    case 'chat.1.chatUi.chatCommandMarkdown': {
      const {convID, md} = action.payload.params
      getConversationInputState(T.Chat.stringToConversationIDKey(convID)).dispatch.setCommandMarkdown(
        md || undefined
      )
      break
    }
    case 'chat.1.chatUi.chatGiphyToggleResultWindow': {
      const {clearInput, convID, show} = action.payload.params
      const dispatch = getConversationInputState(T.Chat.stringToConversationIDKey(convID)).dispatch
      if (clearInput) {
        dispatch.injectIntoInput('')
      }
      dispatch.setGiphyWindow(show)
      break
    }
    case 'chat.1.chatUi.chatGiphySearchResults': {
      const {convID, results} = action.payload.params
      getConversationInputState(T.Chat.stringToConversationIDKey(convID)).dispatch.setGiphyResult(results)
      break
    }
    default:
  }
}

const Context = React.createContext<MadeStore | null>(null)

export const ConversationInputProvider = (p: React.PropsWithChildren<{id: T.Chat.ConversationIDKey}>) => {
  return <Context value={createConversationInputStore(p.id)}>{p.children}</Context>
}

export function useConversationInput<T>(selector: (state: ConversationInputState) => T): T {
  const contextStore = React.useContext(Context)
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const store = contextStore ?? createConversationInputStore(conversationIDKey)
  return useStore(store, selector)
}
