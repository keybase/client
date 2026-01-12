import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

const AddSubteam = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const subteamFilter = useTeamsState(s => s.subteamFilter)
  const setSubteamFilter = useTeamsState(s => s.dispatch.setSubteamFilter)
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const onCreateSubteam = () => launchNewTeamWizardOrModal(teamID)
  const onChangeFilter = (filter: string) => setSubteamFilter(filter, teamID)
  // clear filter on unmount
  React.useEffect(
    () => () => {
      setSubteamFilter('')
    },
    [setSubteamFilter]
  )
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
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
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, 0),
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    isMobile: {
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  containerNew: {
    ...Kb.Styles.padding(6, Kb.Styles.globalMargins.small),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    justifyContent: 'space-between',
  },
  filterInput: {maxWidth: 148},
  text: {padding: Kb.Styles.globalMargins.xtiny},
}))

export default AddSubteam
