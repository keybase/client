import * as TeamsGen from '../../actions/teams-gen'
import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = Container.RouteProps<{link: string[]}>

const JoinFromInvite = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onJoinTeam = () => {}
  const onClose = () => dispatch(nav.safeNavigateUpPayload())
  const teamname = 'gameofthrones'
  const memberCount = 1023
  const description =
    'A team for fans of Game of Thrones. This is to show the max-width on the team description (460px). Ellipsis after three lines of description. This is a third line blah blah blah blah blah blah blah blah blah blah. This is a third line blah blah blah blah blah blah blah blah blah blah. This is a third line blah blah blah blah blah blah blah blah blah blah.'
  const inviterUsername = 'adamjspooner'
  const isOpen = true

  const body = (
    <Kb.Box2
      centerChildren={true}
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="xtiny"
      style={styles.body}
    >
      <Kb.Box style={styles.avatar}>
        <Kb.Avatar size={96} teamname={teamname} isTeam={true} />
        {isOpen && (
          <Kb.Box2
            direction="horizontal"
            style={styles.meta}
            fullWidth={!Styles.isMobile}
            centerChildren={true}
          >
            <Kb.Meta backgroundColor={Styles.globalColors.green} title="open" size="Small" />
          </Kb.Box2>
        )}
      </Kb.Box>
      <Kb.Text type="Header">Join {teamname}</Kb.Text>
      <Kb.Text type="BodySmall">{memberCount.toLocaleString()} members</Kb.Text>
      <Kb.Text type="Body" lineClamp={3} style={styles.description}>
        {description}
      </Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.buttonBar}>
        <Kb.Button type="Success" label="Join team" onClick={onJoinTeam} style={styles.button} />
      </Kb.Box2>
      <Kb.Box style={Styles.globalStyles.flexOne} />
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.inviterBox}>
        <Kb.Avatar
          size={16}
          username={inviterUsername}
          borderColor={Styles.isMobile ? Styles.globalColors.white : undefined}
        />
        <Kb.ConnectedUsernames type="BodySmallBold" usernames={[inviterUsername]} colorFollowing={true} />
        <Kb.Text type="BodySmall"> invited you.</Kb.Text>
      </Kb.Box2>
      {Styles.isMobile && (
        <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.laterBox}>
          <Kb.Button label="Later" type="Dim" onClick={onClose} style={styles.button} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  return Styles.isMobile ? (
    <Kb.MobilePopup overlayStyle={styles.mobileOverlay}>{body}</Kb.MobilePopup>
  ) : (
    <Kb.Modal mode="Wide" allowOverflow={true} noScrollView={true} onClose={onClose}>
      {body}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatar: Styles.platformStyles({
        common: {marginBottom: -36, position: 'relative', top: -48},
        isElectron: {paddingTop: 80},
      }),
      body: Styles.platformStyles({
        common: {
          paddingBottom: Styles.globalMargins.small,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.blueGreyLight,
          borderRadius: 8,
        },
      }),
      button: Styles.platformStyles({
        isElectron: {width: 360},
        isMobile: {
          flex: 1,
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
        },
      }),
      buttonBar: {justifyContent: 'center', paddingTop: Styles.globalMargins.small},
      description: Styles.platformStyles({
        isElectron: {width: 460},
        isMobile: Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.small),
      }),
      inviterBox: {paddingBottom: Styles.globalMargins.small},
      laterBox: {
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        paddingTop: Styles.globalMargins.small,
      },
      meta: {
        bottom: -7,
        position: 'absolute',
      },
      mobileOverlay: {
        height: 392,
      },
    } as const)
)

export default JoinFromInvite
