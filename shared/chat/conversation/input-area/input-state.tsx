import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {clearThreadInputAction} from '@/constants/router'
import {findLast} from '@/util/arrays'
import {useChatThreadRouteParams} from '../thread-search-route'
import {useCurrentUserState} from '@/stores/current-user'
import {useEngineActionListener} from '@/engine/action-listener'
import {useConversationThreadStore} from '../thread-context'
import {useConversationSendActions} from '../send-actions'
import {useInputIntentState, consumeInputIntent, type InputIntent} from '../input-intent-store'

type ConversationInputStore = T.Immutable<{
  commandMarkdown?: T.RPCChat.UICommandMarkdown
  commandStatus?: T.Chat.CommandStatusInfo
  editing: T.Chat.Ordinal
  focusInputCounter: number
  giphyResult?: T.RPCChat.GiphySearchResults
  giphyWindow: boolean
  replyTo: T.Chat.Ordinal
  unsentText?: string
}>

type ConversationInputDispatch = {
  injectIntoInput: (text?: string, focus?: boolean) => void
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

export interface ConversationInputState extends ConversationInputStore {
  dispatch: ConversationInputDispatch
}

const emptyOrdinal = T.Chat.numberToOrdinal(0)

const initialConversationInputStore: ConversationInputStore = {
  commandMarkdown: undefined,
  commandStatus: undefined,
  editing: emptyOrdinal,
  focusInputCounter: 0,
  giphyResult: undefined,
  giphyWindow: false,
  replyTo: emptyOrdinal,
  unsentText: undefined,
}

type InputAction =
  | {type: 'afterSend'}
  | {type: 'injectIntoInput'; focus?: boolean; text?: string}
  | {type: 'resetState'}
  | {type: 'setCommandMarkdown'; md?: T.RPCChat.UICommandMarkdown}
  | {type: 'setCommandStatusInfo'; info?: T.Chat.CommandStatusInfo}
  | {type: 'setEditing'; ordinal: T.Chat.Ordinal; text: string}
  | {type: 'setEditingClear'}
  | {type: 'setGiphyResult'; result?: T.RPCChat.GiphySearchResults}
  | {type: 'setGiphyWindow'; show: boolean}
  | {type: 'setReplyTo'; ordinal: T.Chat.Ordinal}
  | {type: 'toggleGiphyPrefill'}

const inputReducer = (state: ConversationInputStore, action: InputAction): ConversationInputStore => {
  switch (action.type) {
    case 'afterSend':
      return {
        ...state,
        commandMarkdown: undefined,
        editing: emptyOrdinal,
        giphyWindow: false,
        replyTo: emptyOrdinal,
        unsentText: '',
      }
    case 'injectIntoInput':
      return {
        ...state,
        focusInputCounter:
          action.focus && action.text !== undefined ? state.focusInputCounter + 1 : state.focusInputCounter,
        unsentText: action.text,
      }
    case 'resetState':
      return initialConversationInputStore
    case 'setCommandMarkdown':
      return {...state, commandMarkdown: action.md}
    case 'setCommandStatusInfo':
      return {...state, commandStatus: action.info}
    case 'setEditing':
      return {...state, editing: action.ordinal, unsentText: action.text}
    case 'setEditingClear':
      return {...state, editing: emptyOrdinal, unsentText: ''}
    case 'setGiphyResult':
      return {...state, giphyResult: action.result}
    case 'setGiphyWindow':
      return {...state, giphyWindow: action.show}
    case 'setReplyTo':
      return {...state, replyTo: action.ordinal}
    case 'toggleGiphyPrefill':
      return {...state, unsentText: state.giphyWindow ? '' : '/giphy '}
  }
}

const StateContext = React.createContext<ConversationInputStore | undefined>(undefined)
StateContext.displayName = 'ConversationInputStateContext'
const DispatchContext = React.createContext<ConversationInputDispatch | undefined>(undefined)
DispatchContext.displayName = 'ConversationInputDispatchContext'

const actionConversationIDKey = (convID: string) => T.Chat.stringToConversationIDKey(convID)

// 'highlight' belongs to ConversationCenterProvider; claiming it here would let this provider
// silently eat an intent meant for the other consumer.
const storeInputIntentTypes: ReadonlyArray<InputIntent['type']> = [
  'commandStatus',
  'injectText',
  'setEditing',
  'setReplyTo',
]

export const ConversationInputProvider = (p: React.PropsWithChildren<{id: T.Chat.ConversationIDKey}>) => {
  const {children, id} = p
  const routeInputAction = useChatThreadRouteParams()?.inputAction
  const [state, dispatchState] = React.useReducer(inputReducer, initialConversationInputStore)
  // Only setEditing reads thread state, so read it lazily instead of subscribing —
  // a subscription here re-renders the whole input subtree on every thread change.
  const threadStore = useConversationThreadStore()
  const {sendGiphyResult: sendGiphyResultAction, sendMessage} = useConversationSendActions()

  const injectIntoInput = React.useEffectEvent((text?: string, focus?: boolean) => {
    dispatchState({focus, text, type: 'injectIntoInput'})
  })
  const resetState = React.useEffectEvent(() => {
    dispatchState({type: 'resetState'})
  })
  const setCommandMarkdown = React.useEffectEvent((md?: T.RPCChat.UICommandMarkdown) => {
    dispatchState({md, type: 'setCommandMarkdown'})
  })
  const setCommandStatusInfo = React.useEffectEvent((info?: T.Chat.CommandStatusInfo) => {
    dispatchState({info, type: 'setCommandStatusInfo'})
  })
  const setGiphyResult = React.useEffectEvent((result?: T.RPCChat.GiphySearchResults) => {
    dispatchState({result, type: 'setGiphyResult'})
  })
  const setGiphyWindow = React.useEffectEvent((show: boolean) => {
    dispatchState({show, type: 'setGiphyWindow'})
  })
  const setReplyTo = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    dispatchState({ordinal, type: 'setReplyTo'})
  })
  const setEditing = React.useEffectEvent((e: T.Chat.Ordinal | 'last' | 'clear') => {
    if (e === 'clear') {
      dispatchState({type: 'setEditingClear'})
      return
    }

    const {messageMap, messageOrdinals} = threadStore.getState()
    let ordinal: T.Chat.Ordinal | undefined
    if (e === 'last') {
      const editLastUser = useCurrentUserState.getState().username
      ordinal = messageOrdinals
        ? findLast(messageOrdinals, o => {
            const message = messageMap.get(o)
            return !!(
              (message?.type === 'text' || message?.type === 'attachment') &&
              message.author === editLastUser &&
              !message.exploded &&
              message.isEditable
            )
          })
        : undefined
    } else {
      ordinal = e
    }

    // Both bails leave the composer exactly as it was, so from the message menu they read as
    // "Edit did nothing". Say which one happened; there is no other signal that it did.
    if (!ordinal) {
      logger.error(`[chat] setEditing found no editable message (${e === 'last' ? 'last' : 'ordinal'})`)
      return
    }
    const message = messageMap.get(ordinal)
    if (message?.type === 'text' || message?.type === 'attachment') {
      dispatchState({
        ordinal,
        text: message.type === 'text' ? message.text.stringValue() : message.title,
        type: 'setEditing',
      })
    } else {
      logger.error(`[chat] setEditing ignored ordinal ${ordinal}: message is ${message?.type ?? 'missing'}`)
    }
  })
  const sendComposerText = React.useEffectEvent((text: string) => {
    sendMessage(text, {
      editingOrdinal: state.editing,
      onRestoreText: injectIntoInput,
      replyToOrdinal: state.replyTo,
    })
    dispatchState({type: 'afterSend'})
  })
  const sendGiphyResult = React.useEffectEvent((result: T.RPCChat.GiphySearchResult) => {
    sendGiphyResultAction(result, state.replyTo)
    dispatchState({type: 'afterSend'})
  })
  const toggleGiphyPrefill = React.useEffectEvent(() => {
    dispatchState({type: 'toggleGiphyPrefill'})
  })
  const [inputDispatch] = React.useState<ConversationInputDispatch>(() => ({
    injectIntoInput,
    resetState,
    sendComposerText,
    sendGiphyResult,
    setCommandMarkdown,
    setCommandStatusInfo,
    setEditing,
    setGiphyResult,
    setGiphyWindow,
    setReplyTo,
    toggleGiphyPrefill,
  }))

  const applyInputAction = React.useEffectEvent(
    (action: T.Immutable<Exclude<InputIntent, {type: 'highlight'}>>) => {
      switch (action.type) {
        case 'commandStatus':
          setCommandStatusInfo(
            action.info
              ? {
                  actions: T.castDraft(action.info.actions),
                  displayText: action.info.displayText,
                  displayType: action.info.displayType,
                }
              : undefined
          )
          break
        case 'injectText':
          injectIntoInput(action.text)
          break
        case 'setEditing':
          setEditing(action.ordinal)
          break
        case 'setReplyTo':
          setReplyTo(action.ordinal)
          break
      }
    }
  )
  const consumedInputActionRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (!routeInputAction) {
      consumedInputActionRef.current = undefined
      return
    }
    if (consumedInputActionRef.current === routeInputAction.key) {
      return
    }
    consumedInputActionRef.current = routeInputAction.key
    applyInputAction(routeInputAction)
    clearThreadInputAction(routeInputAction.key)
  }, [routeInputAction])

  React.useEffect(() => {
    const consume = () => {
      const intent = consumeInputIntent(id, storeInputIntentTypes)
      if (intent) {
        applyInputAction(intent as T.Immutable<Exclude<InputIntent, {type: 'highlight'}>>)
      }
    }
    consume()
    return useInputIntentState.subscribe(consume)
  }, [id])

  useEngineActionListener('chat.1.chatUi.chatCommandStatus', action => {
    const {actions, convID, displayText, typ} = action.payload.params
    if (actionConversationIDKey(convID) !== id) {
      return
    }
    setCommandStatusInfo({
      actions: T.castDraft(actions) || [],
      displayText,
      displayType: typ,
    })
  })
  useEngineActionListener('chat.1.chatUi.chatCommandMarkdown', action => {
    const {convID, md} = action.payload.params
    if (actionConversationIDKey(convID) !== id) {
      return
    }
    setCommandMarkdown(md || undefined)
  })
  useEngineActionListener('chat.1.chatUi.chatGiphyToggleResultWindow', action => {
    const {clearInput, convID, show} = action.payload.params
    if (actionConversationIDKey(convID) !== id) {
      return
    }
    if (clearInput) {
      injectIntoInput('')
    }
    setGiphyWindow(show)
  })
  useEngineActionListener('chat.1.chatUi.chatGiphySearchResults', action => {
    const {convID, results} = action.payload.params
    if (actionConversationIDKey(convID) !== id) {
      return
    }
    setGiphyResult(results)
  })

  return (
    <DispatchContext value={inputDispatch}>
      <StateContext value={state}>{children}</StateContext>
    </DispatchContext>
  )
}

// For callers that may or may not sit inside the provider — the message popup is rendered inline
// in the thread on desktop but as its own modal route on phones, and from the info panel and the
// attachment viewer it is outside the thread entirely. Inside, talk to the store directly; the
// router round-trip is only there to reach across a screen boundary.
export function useConversationInputDispatchOptional(): ConversationInputDispatch | undefined {
  return React.useContext(DispatchContext)
}

export function useConversationInput<T>(selector: (state: ConversationInputState) => T): T {
  const state = React.useContext(StateContext)
  const dispatch = React.useContext(DispatchContext)
  if (!state || !dispatch) {
    throw new Error('Missing ConversationInputProvider in the tree')
  }
  return selector({...state, dispatch})
}

export function useConversationInputDispatch<T>(selector: (dispatch: ConversationInputDispatch) => T): T {
  const dispatch = React.useContext(DispatchContext)
  if (!dispatch) {
    throw new Error('Missing ConversationInputProvider in the tree')
  }
  return selector(dispatch)
}
