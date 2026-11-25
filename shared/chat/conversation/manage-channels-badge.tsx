import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import * as React from 'react'

const chosenChannelsGregorKey = 'chosenChannelsForTeam'

export const useChosenChannelsTeamnames = () => {
  const teamnames = useConfigState(s => s.gregorUIPrefs.chosenChannelsTeamnames)
  return React.useMemo(() => new Set(teamnames), [teamnames])
}

export const updateChosenChannelsTeamnames = async (teamnames: ReadonlySet<string>) =>
  await T.RPCGen.gregorUpdateCategoryRpcPromise({
    body: JSON.stringify([...teamnames]),
    category: chosenChannelsGregorKey,
    dtime: {offset: 0, time: 0},
  })
