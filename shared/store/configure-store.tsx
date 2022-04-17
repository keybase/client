import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'
import logger from '../logger'
import rootReducer from '../reducers'
import {actionLogger} from './action-logger'
import {convertToError} from '../util/errors'
import {createStore, applyMiddleware, type Store} from 'redux'
import {enableStoreLogging, enableActionLogging} from '../local-debug'
import * as DevGen from '../actions/dev-gen'
import * as ConfigGen from '../actions/config-gen'
import {isMobile} from '../constants/platform'
import {hookMiddleware} from './hook-middleware'
import type {TypedState} from '../constants/reducer'

let theStore: Store<any, any>

export const DEBUGDump = (conversationIDKey: string) => {
  const s = theStore.getState() as TypedState
  const c2 = s.chat2
  const allOrdinals = c2.messageOrdinals.get(conversationIDKey)
  const meta = c2.metaMap.get(conversationIDKey)
  const badges = c2.badgeMap.get(conversationIDKey)
  const drafts = c2.draftMap.get(conversationIDKey)
  const unread = c2.unreadMap.get(conversationIDKey)
  const editing = c2.editingMap.get(conversationIDKey)
  const mm = c2.messageMap.get(conversationIDKey)
  const msgs = [...(mm?.keys() ?? [])].map((mid: number) => {
    const msg = mm?.get(mid)
    if (!msg) return ''
    // @ts-ignore reaching into not narrowed types
    const {type, ordinal, outboxID, submitState, text} = msg
    return {
      ordinal,
      outboxID,
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

export const sagaMiddleware = (__DEV__ && global.DEBUGSagaMiddleware) || createSagaMiddleware(crashHandler)
// don't overwrite this on HMR
if (__DEV__) {
  global.DEBUGSagaMiddleware = sagaMiddleware
}

const freezeMiddleware = _store => next => action => next(Object.freeze(action))

const middlewares = [
  errorCatching,
  sagaMiddleware,
  ...(__DEV__ ? [freezeMiddleware] : []),
  ...(enableStoreLogging && loggerMiddleware ? [loggerMiddleware] : []),
  ...(enableActionLogging ? [actionLogger] : []),
  hookMiddleware,
]

if (__DEV__ && typeof window !== 'undefined') {
  global.DEBUGActionLoop = () => {
    setInterval(() => {
      theStore.dispatch(DevGen.createDebugCount())
    }, 1000)
  }
}

export default function configureStore() {
  const store = createStore(rootReducer, undefined, applyMiddleware(...middlewares))
  theStore = store

  if (module.hot && !isMobile) {
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  return {runSagas, store}
}
