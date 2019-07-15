import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import {teamsLoadedWaitingKey} from '../../constants/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {globalMargins, desktopStyles, platformStyles, styleSheetCreate} from '../../styles'

const NoTeamsPlaceholder = () => {
  const dispatch = Container.useDispatch()
  const onCreateTeam = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {}, selected: 'teamNewTeamDialog'}],
      })
    )
  const onJoinTeam = () => dispatch(RouteTreeGen.createNavigateAppend({path: ['teamJoinTeamDialog']}))

  const isLoadingTeams = Container.useAnyWaiting(teamsLoadedWaitingKey)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
      {isLoadingTeams ? (
        <Kb.ProgressIndicator type="Large" />
      ) : (
        <React.Fragment>
          <Kb.Text type="BodySmall">You are not a part of any teams.</Kb.Text>
          <Kb.Text type="BodySmall">
            <Kb.Text type="BodySmallPrimaryLink" onClick={onCreateTeam}>
              Create a team
            </Kb.Text>{' '}
            or{' '}
            <Kb.Text type="BodySmallPrimaryLink" onClick={onJoinTeam}>
              join a team you know.
            </Kb.Text>
          </Kb.Text>
        </React.Fragment>
      )}
    </Kb.Box2>
  )
}

const styles = styleSheetCreate({
  container: {
    marginBottom: globalMargins.large,
    marginLeft: globalMargins.medium,
    marginRight: globalMargins.medium,
    marginTop: globalMargins.large,
  },
})

export default NoTeamsPlaceholder
