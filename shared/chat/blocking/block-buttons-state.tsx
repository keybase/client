import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {bodyToJSON} from '@/constants/rpc-utils'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'

const blockButtonsGregorPrefix = 'blockButtons.'

const gregorItemsToBlockButtons = (
  items?: ReadonlyArray<{readonly item?: T.RPCGen.Gregor1.Item | null}> | null
) =>
  (items ?? []).reduce<Map<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo>>((map, {item}) => {
    if (!item?.category.startsWith(blockButtonsGregorPrefix)) {
      return map
    }
    try {
      const teamID = item.category.substring(blockButtonsGregorPrefix.length)
      const body = bodyToJSON(item.body) as {adder?: unknown} | undefined
      if (typeof body?.adder === 'string') {
        map.set(teamID, {adder: body.adder})
      }
    } catch (error) {
      logger.info('block buttons parse fail', error)
    }
    return map
  }, new Map())

type Store = T.Immutable<{
  blockButtonsMap: ReadonlyMap<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo>
  loadGeneration: number
  loaded: boolean
}>

const makeInitialStore = (): Store => ({
  blockButtonsMap: new Map(),
  loadGeneration: 0,
  loaded: false,
})

type State = Store & {
  dispatch: {
    load: () => void
    resetState: () => void
    updateFromGregorItems: (
      items?: ReadonlyArray<{readonly item?: T.RPCGen.Gregor1.Item | null}> | null
    ) => void
  }
}

// Promises can't live in immer-managed state, so this stays module-level. It's
// paired with the store's loadGeneration: resetState clears this AND bumps the
// generation so a load in flight at reset time can't win the race and write
// into the fresh state after it resolves.
let activeLoadPromise: Promise<void> | undefined

export const useBlockButtonsState = Z.createZustand<State>('block-buttons', (set, get) => {
  const setFromGregorItems: State['dispatch']['updateFromGregorItems'] = items => {
    set(s => {
      s.blockButtonsMap = gregorItemsToBlockButtons(items)
      s.loaded = true
    })
  }

  const dispatch: State['dispatch'] = {
    load: () => {
      if (get().loaded || activeLoadPromise) {
        return
      }
      const generation = get().loadGeneration
      const request = (async () => {
        try {
          const state = await T.RPCGen.gregorGetStateRpcPromise()
          if (generation === get().loadGeneration) {
            setFromGregorItems(state.items)
          }
        } catch (error) {
          logger.warn('Failed to load block button state', error)
        }
      })()
      activeLoadPromise = request
      ignorePromise(
        request.finally(() => {
          if (activeLoadPromise === request) {
            activeLoadPromise = undefined
          }
        })
      )
    },
    resetState: () => {
      activeLoadPromise = undefined
      set(s => ({
        ...makeInitialStore(),
        dispatch: s.dispatch,
        loadGeneration: s.loadGeneration + 1,
      }))
    },
    updateFromGregorItems: items => {
      set(s => {
        s.loadGeneration++
      })
      setFromGregorItems(items)
    },
  }

  return {
    ...makeInitialStore(),
    dispatch,
  }
})

export const useBlockButtonsInfo = (teamID: T.Teams.TeamID) => {
  const {blockButtonsInfo, load} = useBlockButtonsState(
    Z.useShallow(s => ({
      blockButtonsInfo: s.blockButtonsMap.get(teamID),
      load: s.dispatch.load,
    }))
  )
  React.useEffect(() => {
    load()
  }, [load])

  return blockButtonsInfo
}
