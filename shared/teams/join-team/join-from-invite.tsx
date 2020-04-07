import * as TeamsGen from '../../actions/teams-gen'
import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/teams'
import {Success} from '.'

type NoDetails = 'NODETAILS'
const noDetails: NoDetails = 'NODETAILS'
type Props = Container.RouteProps<{details: RPCTypes.InviteLinkDetails | NoDetails}>

const JoinFromInvite = (props: Props) => {
  const details = Container.getRouteProps(props, 'details', noDetails)
  if (details === noDetails || !details.teamName.parts) {
    throw new Error('Details or teamname not passed to invite join modal')
  }
  const teamname = details.teamName.parts.join('.')

  const [clickedJoin, setClickedJoin] = React.useState(false)
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const error = Container.useSelector(state => state.teams.errorInTeamJoin)

  const onNavUp = () => dispatch(nav.safeNavigateUpPayload())
  const onDecide = (accept: boolean) => dispatch(TeamsGen.createRespondToInviteLink({accept}))
  const onJoinTeam = () => {
    setClickedJoin(true)
    onDecide(true)
  }
  const onClose = () => {
    onDecide(true)
    onNavUp()
  }

  const rpcWaiting = Container.useAnyWaiting(Constants.joinTeamWaitingKey)
  const waiting = rpcWaiting && clickedJoin
  const wasWaiting = Container.usePrevious(waiting)
  const showSuccess = wasWaiting && !waiting && !error

  const body = showSuccess ? (
    <Kb.Box2
      direction="vertical"
      style={styles.center}
      fullWidth={true}
      fullHeight={true}
      gap="small"
      centerChildren={true}
    >
      <Success teamname={teamname} />
      <Kb.Button type="Dim" label="Close" onClick={onNavUp} style={styles.button} waiting={waiting} />
    </Kb.Box2>
  ) : (
    <Kb.Box2
      centerChildren={true}
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="xtiny"
      style={styles.body}
    >
      <Kb.Box style={styles.avatar}>
        <Kb.Avatar
          size={96}
          teamname={teamname}
          isTeam={true}
          imageOverrideUrl={details.teamAvatars['square_192']}
        />
        {details.teamIsOpen && (
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
      <Kb.Text type="BodySmall">{details.teamNumMembers.toLocaleString()} members</Kb.Text>
      <Kb.Text type="Body" lineClamp={3} style={styles.description}>
        {details.teamDesc}
      </Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.buttonBar}>
        <Kb.Button
          type="Success"
          label="Join team"
          onClick={onJoinTeam}
          style={styles.button}
          waiting={waiting}
        />
      </Kb.Box2>
      {error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
      <Kb.Box style={Styles.globalStyles.flexOne} />
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.inviterBox}>
        <Kb.Avatar
          size={16}
          username={details.inviterUsername}
          borderColor={Styles.isMobile ? Styles.globalColors.white : undefined}
        />
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          usernames={[details.inviterUsername]}
          colorFollowing={true}
        />
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
      center: {justifyContent: 'center'},
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
