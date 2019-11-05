import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/teams'
import * as Types from '../../../../constants/types/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

const AddSubteam = ({teamID}: {teamID: Types.TeamID}) => {
  const {teamname} = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const dispatch = Container.useDispatch()
  const onCreateSubteam = React.useCallback(
    () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {makeSubteam: true, name: teamname}, selected: 'teamNewTeamDialog'}],
        })
      ),
    [dispatch, teamname]
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
  text: {padding: Styles.globalMargins.xtiny},
}))

export default AddSubteam
