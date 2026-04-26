import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import {isPhone} from '@/constants/platform'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'

type Store = T.Immutable<{
  hasLoaded: boolean
  layout?: T.RPCChat.UIInboxLayout
  retriedOnCurrentEmpty: boolean
}>

const initialStore: Store = {
  hasLoaded: false,
  layout: undefined,
  retriedOnCurrentEmpty: false,
}

type State = Store & {
  dispatch: {
    refresh: (reason: T.Chat.RefreshReason) => Promise<void>
    resetState: () => void
    setRetriedOnCurrentEmpty: (retried: boolean) => void
    updateLayout: (layout: string) => void
  }
}

const hasInboxRows = (layout: T.RPCChat.UIInboxLayout) =>
  (layout.smallTeams?.length ?? 0) > 0 ||
  (layout.bigTeams?.length ?? 0) > 0 ||
  layout.totalSmallTeams > 0

export const isEmptyInboxLayout = (layout: T.RPCChat.UIInboxLayout | undefined) =>
  !!layout && (layout.smallTeams || []).length === 0 && (layout.bigTeams || []).length === 0

export const useInboxLayoutState = Z.createZustand<State>('chat-inbox-layout', (set, get) => {
  const requestInboxLayout = async (reason: T.Chat.RefreshReason) => {
    const {username} = useCurrentUserState.getState()
    const {loggedIn} = useConfigState.getState()
    if (!loggedIn || !username) {
      return
    }

    logger.info(`Inbox refresh due to ${reason}`)
    const reselectMode =
      get().hasLoaded || isPhone
        ? T.RPCChat.InboxLayoutReselectMode.default
        : T.RPCChat.InboxLayoutReselectMode.force
    await T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode})
  }

  const dispatch: State['dispatch'] = {
    refresh: async reason => requestInboxLayout(reason),
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
    setRetriedOnCurrentEmpty: retried => {
      set(s => {
        s.retriedOnCurrentEmpty = retried
      })
    },
    updateLayout: str => {
      set(s => {
        try {
          const _layout = JSON.parse(str) as unknown
          if (!_layout || typeof _layout !== 'object') {
            logger.warn(
              `Invalid inbox layout JSON: expected object, got ${_layout === null ? 'null' : typeof _layout}`
            )
            return
          }
          const layout = _layout as T.RPCChat.UIInboxLayout
          const layoutChanged = !isEqual(s.layout, layout)
          if (layoutChanged) {
            s.layout = T.castDraft(layout)
          }
          s.hasLoaded = !!layout
          if (hasInboxRows(layout)) {
            s.retriedOnCurrentEmpty = false
          }
        } catch (e) {
          logger.warn('failed to JSON parse inbox layout', e)
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

export const useInboxLayout = () =>
  useInboxLayoutState(
    Z.useShallow(s => ({
      hasLoaded: s.hasLoaded,
      layout: s.layout,
      refresh: s.dispatch.refresh,
    }))
  )

export const useInboxRetryState = () =>
  useInboxLayoutState(
    Z.useShallow(s => ({
      retriedOnCurrentEmpty: s.retriedOnCurrentEmpty,
      setRetriedOnCurrentEmpty: s.dispatch.setRetriedOnCurrentEmpty,
    }))
  )
