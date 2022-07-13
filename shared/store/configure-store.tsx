import * as ReduxToolKit from '@reduxjs/toolkit'
import {listenerMiddleware} from '../util/redux-toolkit'
import * as ConfigGen from '../actions/config-gen'
import logger from '../logger'
import {reducers} from '../reducers'
import type {TypedState} from '../constants/reducer'
import {DEBUG_CHAT_DUMP} from '../constants/chat2'
import {actionLogger} from './action-logger'
import {convertToError} from '../util/errors'
import {type Store} from 'redux'
import {enableStoreLogging, enableActionLogging} from '../local-debug'
import {isMobile} from '../constants/platform'
import {initListeners} from './configure-listeners'

let theStore: Store<any, any>

export const DEBUGDump = (conversationIDKey: string) => {
  if (!DEBUG_CHAT_DUMP) {
    return
  }
  const s = theStore?.getState() as TypedState
  if (!s) return
  const c2 = s.chat2
  const allOrdinals = [...(c2.messageOrdinals.get(conversationIDKey) ?? [])]
  let meta: any = c2.metaMap.get(conversationIDKey)
  if (meta) {
    meta = {...meta}
    meta.snippet = 'x'
    meta.snippetDecorated = 'x'
    meta.teamname = 'tn'
    meta.pinnedMsg = 'pn'
  }
  const pendingOutboxToOrdinal = [...(c2.pendingOutboxToOrdinal.get(conversationIDKey)?.entries() ?? [])]

  const badges = c2.badgeMap.get(conversationIDKey)
  const drafts = c2.draftMap.get(conversationIDKey)
  const unread = c2.unreadMap.get(conversationIDKey)
  const editing = c2.editingMap.get(conversationIDKey)
  const mm = c2.messageMap.get(conversationIDKey)
  const msgs = [...(mm?.keys() ?? [])].map((mid: number) => {
    const msg = mm?.get(mid)
    if (!msg) return ''
    // @ts-ignore reaching into not narrowed types
    const {id, type, ordinal, outboxID, submitState, text, reactions} = msg

    const reactionInfo = [...(reactions?.entries() ?? [])].map(([k, v]) => {
      return {
        keyLen: k.length,
        val: {
          userLen: [...v.users].length,
        },
      }
    })

    return {
      id,
      ordinal,
      outboxID,
      pendingOutboxToOrdinal,
      reactionInfo,
      submitState,
      textLen: text?.stringValue().length ?? 0,
      type,
    }
  })
  const output = {
    allOrdinals,
    badges,
    drafts,
    editing,
    meta,
    msgs,
    unread,
  }

  logger.error('chat debug dump: ', JSON.stringify(output))
}

const crashHandler = error => {
  if (__DEV__) {
    throw error
  }
  if (theStore) {
    theStore.dispatch(
      ConfigGen.createGlobalError({
        globalError: convertToError(error),
      })
    )
  } else {
    logger.warn('Got crash before store created?', error)
  }
}

let loggerMiddleware: any
let lastError = new Error('')

const errorCatching = () => next => action => {
  try {
    return next(action)
  } catch (error_) {
    const error = error_ as any
    // Don't let the same error keep getting caught
    if (lastError.message === error.message) {
      return
    }
    lastError = error
    logger.warn(`Caught a middleware exception`)
    logger.debug(`Caught a middleware exception`, error)

    try {
      crashHandler(error) // don't let this thing crash us forever
    } catch (_) {}
  }
}

const freezeMiddleware = _store => next => action => next(Object.freeze(action))

const middlewares = [
  listenerMiddleware.middleware,
  errorCatching,
  ...(__DEV__ ? [freezeMiddleware] : []),
  ...(enableStoreLogging && loggerMiddleware ? [loggerMiddleware] : []),
  ...(enableActionLogging ? [actionLogger] : []),
]

// don't setup listeners again
if (__DEV__ && !globalThis.listenersInited) {
  globalThis.listenersInited = false
}

export default function makeStore() {
  const store = ReduxToolKit.configureStore({
    devTools: false,
    middleware: () => middlewares,
    // @ts-ignore we prefer our typing to what the toolkit gives
    reducer: reducers,
  })
  // @ts-ignore
  theStore = store

  if (module.hot && !isMobile) {
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  return {
    initListeners: () => {
      if (__DEV__) {
        if (globalThis.listenersInited) {
          console.log('Dev reloading not registering listeners again')
          return
        } else {
          globalThis.listenersInited = true
        }
      }
      // register our listeners
      initListeners()
      // start our 'forks'
      store.dispatch(ConfigGen.createInitListenerLoops())
    },
    store,
  }
}
