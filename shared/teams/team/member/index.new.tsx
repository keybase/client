import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'

type Props = {
  teamID: Types.TeamID
  username: string
}

class TeamMember extends React.Component<Container.RouteProps<Props>> {
  static navigationOptions = (ownProps: Container.RouteProps<Props>) => ({
    header: Container.isMobile
      ? () => (
          <TeamMemberHeader
            teamID={Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)}
            username={Container.getRouteProps(ownProps, 'username', '')}
          />
        )
      : undefined,
    headerExpandable: true,
    headerTitle: () => (
      <TeamMemberHeader
        teamID={Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)}
        username={Container.getRouteProps(ownProps, 'username', '')}
      />
    ),
  })
  render() {
    return null
  }
}

const TeamMemberHeader = (props: Props) => {
  const {teamID, username} = props
  const dispatch = Container.useDispatch()

  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const onBack = () => {} // TODO

  const member = teamDetails.members.get(username)
  if (!member) {
    // loading? should never happen.
    return null
  }

  const buttons = <Kb.Text type="Header">Buttons go here</Kb.Text>

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.headerContainer}>
      {Styles.isMobile && (
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
          <Kb.BackButton onClick={onBack} />
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            gap={Styles.isMobile ? 'tiny' : 'xtiny'}
            alignSelf="flex-start"
          >
            <Kb.Avatar size={16} teamname={teamMeta.teamname} />
            <Kb.Text
              type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmallSemiboldSecondaryLink'}
              onClick={() => {} /* TODO */}
            >
              {teamMeta.teamname}
            </Kb.Text>
          </Kb.Box2>

          <Kb.Box2 direction="horizontal" gap="large" fullWidth={true} alignItems="flex-end">
            <Kb.Box2 direction="horizontal" gap="small">
              <Kb.Avatar size={64} username={username} />
              <Kb.Box2 direction="vertical" alignItems="flex-start">
                <Kb.ConnectedUsernames type="Header" usernames={[username]} />
                <Kb.Text type="BodySemibold">{member.fullName}</Kb.Text>
                <Kb.Text type="BodySmall">Joined 1m ago</Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isMobile && buttons}
          </Kb.Box2>
          {Styles.isMobile && buttons}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  headerContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  headerContent: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
}))

export default TeamMember
