import {bodyToJSON} from '@/constants/rpc-utils'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import * as React from 'react'

const chosenChannelsGregorKey = 'chosenChannelsForTeam'

export const getChosenChannelsTeamnames = (
  items: ReadonlyArray<{readonly item?: T.RPCGen.Gregor1.Item | null}> | null | undefined
): Set<string> => {
  const chosenChannels = items?.find(item => item.item?.category === chosenChannelsGregorKey)
  const parsed = bodyToJSON(chosenChannels?.item?.body)
  return new Set(
    Array.isArray(parsed) ? parsed.filter((teamname): teamname is string => typeof teamname === 'string') : []
  )
}

export const useChosenChannelsTeamnames = () => {
  const gregorPushState = useConfigState(s => s.gregorPushState)
  return React.useMemo(() => getChosenChannelsTeamnames(gregorPushState), [gregorPushState])
}

export const updateChosenChannelsTeamnames = (teamnames: ReadonlySet<string>) =>
  T.RPCGen.gregorUpdateCategoryRpcPromise({
    body: JSON.stringify([...teamnames]),
    category: chosenChannelsGregorKey,
    dtime: {offset: 0, time: 0},
  })
