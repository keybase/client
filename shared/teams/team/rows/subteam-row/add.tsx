import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/teams'
import * as TeamsGen from '../../../../actions/teams-gen'

const AddSubteam = ({teamID}: {teamID: Types.TeamID}) => {
  const dispatch = Container.useDispatch()
  const subteamFilter = Constants.useState(s => s.subteamFilter)
  const setSubteamFilter = Constants.useState(s => s.dispatch.setSubteamFilter)
  const onCreateSubteam = () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal({subteamOf: teamID}))
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
      {!Styles.isMobile && (
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

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.padding(Styles.globalMargins.tiny, 0),
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  containerNew: {
    ...Styles.padding(6, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.blueGrey,
    justifyContent: 'space-between',
  },
  filterInput: {maxWidth: 148},
  text: {padding: Styles.globalMargins.xtiny},
}))

export default AddSubteam
