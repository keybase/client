import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ProfileGen from '../../../actions/profile-gen'

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
  const nav = Container.useSafeNavigation()

  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const yourUsername = Container.useSelector(s => s.config.username)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  const onViewProfile = () => dispatch(ProfileGen.createShowUserProfile({username}))

  const member = teamDetails.members.get(username)
  if (!member) {
    // loading? should never happen.
    return null
  }

  const buttons = (
    <Kb.Box2 direction="horizontal" gap="tiny" alignSelf={Styles.isMobile ? 'flex-start' : 'flex-end'}>
      <Kb.Button small={true} label="Chat" onClick={onChat} />
      <Kb.Button small={true} label="View profile" onClick={onViewProfile} mode="Secondary" />
      {username !== yourUsername && <BlockDropdown username={username} />}
    </Kb.Box2>
  )

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

          <Kb.Box2
            direction="horizontal"
            gap="large"
            fullWidth={true}
            alignItems="flex-end"
            style={styles.headerTextContainer}
          >
            <Kb.Box2 direction="horizontal" gap="small">
              <Kb.Avatar size={64} username={username} />
              <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.headerText}>
                <Kb.ConnectedUsernames type="Header" usernames={[username]} />
                {!!member.fullName && <Kb.Text type="BodySemibold">{member.fullName}</Kb.Text>}
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

const _BlockDropdown = (props: Kb.PropsWithOverlay<{username: string}>) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBlock = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {username: props.username}, selected: 'chatBlockingModal'}],
      })
    )
  return (
    <>
      <Kb.Button
        small={true}
        icon="iconfont-ellipsis"
        tooltip=""
        onClick={props.toggleShowingMenu}
        mode="Secondary"
        ref={props.setAttachmentRef}
      />
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        onHidden={props.toggleShowingMenu}
        closeOnSelect={true}
        items={[{danger: true, icon: 'iconfont-remove', onClick: onBlock, title: 'Block'}]}
      />
    </>
  )
}
const BlockDropdown = Kb.OverlayParentHOC(_BlockDropdown)

const styles = Styles.styleSheetCreate(() => ({
  headerContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      paddingBottom: Styles.globalMargins.small,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  headerContent: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
  headerText: Styles.platformStyles({
    isElectron: {
      width: 127,
    },
  }),
  headerTextContainer: Styles.platformStyles({
    isMobile: {paddingBottom: Styles.globalMargins.tiny},
  }),
}))

export default TeamMember
