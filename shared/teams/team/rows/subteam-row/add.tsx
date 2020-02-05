import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import flags from '../../../../util/feature-flags'

const AddSubteam = ({teamID}: {teamID: Types.TeamID}) => {
  const dispatch = Container.useDispatch()
  const onCreateSubteam = React.useCallback(
    () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {subteamOf: teamID}, selected: 'teamNewTeamDialog'}],
        })
      ),
    [dispatch, teamID]
  )
  return (
    <Kb.ClickableBox style={styles.container} onClick={onCreateSubteam}>
      <Kb.Box2 direction="horizontal" alignItems="center">
        <Kb.Icon type="iconfont-new" color={Styles.globalColors.blueDark} />
        <Kb.Text type="BodyBigLink" style={styles.text}>
          Create subteam
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const AddSubteamNew = ({teamID}: {teamID: Types.TeamID}) => {
  const dispatch = Container.useDispatch()
  const onCreateSubteam = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {subteamOf: teamID}, selected: 'teamNewTeamDialog'}],
      })
    )
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
      <Kb.Button mode="Secondary" label="Create subteam" onClick={onCreateSubteam} small={true} />
      <Kb.SearchFilter size="small" placeholderText="Filter" onChange={() => {} /* TODO */} />
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
  text: {padding: Styles.globalMargins.xtiny},
}))

export default flags.teamsRedesign ? AddSubteamNew : AddSubteam
