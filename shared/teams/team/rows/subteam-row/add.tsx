import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {makeNewTeamWizard} from '@/teams/new-team/wizard/state'

type Props = {
  setSubteamFilter: React.Dispatch<React.SetStateAction<string>>
  subteamFilter: string
  teamID: T.Teams.TeamID
}

const AddSubteam = ({setSubteamFilter, subteamFilter, teamID}: Props) => {
  const nav = useSafeNavigation()
  const onCreateSubteam = () =>
    nav.safeNavigateAppend({
      name: 'teamWizard2TeamInfo',
      params: {wizard: makeNewTeamWizard({parentTeamID: teamID, teamType: 'subteam'})},
    })
  const onChangeFilter = (filter: string) => setSubteamFilter(filter)
  // clear filter on unmount
  React.useEffect(
    () => () => {
      setSubteamFilter('')
    },
    [setSubteamFilter]
  )
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew} justifyContent="space-between">
      <Kb.Button mode="Secondary" label="Create subteam" onClick={onCreateSubteam} small={true} />
      {!Kb.Styles.isMobile && (
        <Kb.SearchFilter
          size="small"
          placeholderText="Filter"
          onChange={onChangeFilter}
          hotkey="k"
          value={subteamFilter}
          valueControlled={true}
          style={styles.filterInput}
        />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Kb.Styles.padding(6, Kb.Styles.globalMargins.small),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  filterInput: {maxWidth: 148},
}))

export default AddSubteam
