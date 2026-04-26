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
  loaded: boolean
}>

const makeInitialStore = (): Store => ({
  blockButtonsMap: new Map(),
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

let loadPromise: Promise<void> | undefined
let loadGeneration = 0

export const useBlockButtonsState = Z.createZustand<State>('block-buttons', (set, get) => {
  const setFromGregorItems: State['dispatch']['updateFromGregorItems'] = items => {
    set(s => {
      s.blockButtonsMap = gregorItemsToBlockButtons(items)
      s.loaded = true
    })
  }

  const dispatch: State['dispatch'] = {
    load: () => {
      if (get().loaded || loadPromise) {
        return
      }
      const generation = loadGeneration
      const request = (async () => {
        try {
          const state = await T.RPCGen.gregorGetStateRpcPromise()
          if (generation === loadGeneration) {
            setFromGregorItems(state.items)
          }
        } catch (error) {
          logger.warn('Failed to load block button state', error)
        }
      })()
      loadPromise = request
      ignorePromise(
        request.finally(() => {
          if (loadPromise === request) {
            loadPromise = undefined
          }
        })
      )
    },
    resetState: () => {
      loadGeneration++
      loadPromise = undefined
      set(s => ({
        ...makeInitialStore(),
        dispatch: s.dispatch,
      }))
    },
    updateFromGregorItems: items => {
      loadGeneration++
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
