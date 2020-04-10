import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import {teamsLoadedWaitingKey} from '../../constants/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

const TeamsFooter = (props: {empty: boolean}) => {
  const dispatch = Container.useDispatch()
  const onCreateTeam = () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal())
  const onJoinTeam = () => dispatch(RouteTreeGen.createNavigateAppend({path: ['teamJoinTeamDialog']}))

  const isLoadingTeams = Container.useAnyWaiting(teamsLoadedWaitingKey)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
      {isLoadingTeams ? (
        <Kb.ProgressIndicator type="Large" />
      ) : flags.teamsRedesign ? (
        <>
          {props.empty && (
            <Kb.Text type="BodySmall" style={styles.empty}>
              You are not a part of any team,
            </Kb.Text>
          )}
          {props.empty && <Kb.Text type="BodySmall">lone wolf.</Kb.Text>}
          <Kb.Box style={Styles.globalStyles.flexOne} />
          {(Styles.isMobile || !props.empty) && (
            <Kb.Text type="BodySmall">
              Keybase team chats are encrypted – unlike Slack – and work for any size group, from casual
              friends to large communities.
            </Kb.Text>
          )}
        </>
      ) : props.empty ? (
        <>
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
        </>
      ) : null}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: flags.teamsRedesign
    ? Styles.platformStyles({
        isElectron: Styles.padding(Styles.globalMargins.large),
        isMobile: Styles.padding(
          Styles.globalMargins.medium,
          Styles.globalMargins.medium,
          Styles.globalMargins.small
        ),
      })
    : {
        paddingBottom: Styles.globalMargins.large,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.large,
      },
  empty: Styles.platformStyles({
    isElectron: {paddingTop: 120},
    isMobile: {paddingTop: 80},
  }),
}))

export default TeamsFooter
