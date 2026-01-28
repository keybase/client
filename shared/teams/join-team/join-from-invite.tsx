import * as C from '@/constants'
import * as React from 'react'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {Success} from './container'
import {useSafeNavigation} from '@/util/safe-navigation'

const JoinFromInvite = () => {
  const {inviteID: id, inviteKey: key, inviteDetails: details} = useTeamsState(s => s.teamInviteDetails)
  const error = useTeamsState(s => s.errorInTeamJoin)
  const loaded = details !== undefined || !!error

  const joinTeam = useTeamsState(s => s.dispatch.joinTeam)
  const requestInviteLinkDetails = useTeamsState(s => s.dispatch.requestInviteLinkDetails)

  React.useEffect(() => {
    if (loaded) {
      return
    }
    if (key === '') {
      // If we're missing the key, we want the user to paste the whole link again
      requestInviteLinkDetails()
      return
    }

    // Otherwise we're reusing the join flow, so that we don't look up the invite id twice
    // (the invite id is derived from the key).
    joinTeam(key, true)
  }, [requestInviteLinkDetails, joinTeam, loaded, key, id])

  const [clickedJoin, setClickedJoin] = React.useState(false)
  const nav = useSafeNavigation()

  const onNavUp = () => nav.safeNavigateUp()
  const respondToInviteLink = useTeamsState(s => s.dispatch.dynamic.respondToInviteLink)
  const onJoinTeam = () => {
    setClickedJoin(true)
    respondToInviteLink?.(true)
  }
  const onClose = () => {
    respondToInviteLink?.(true)
    onNavUp()
  }

  const rpcWaiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsJoinTeam)
  const waiting = rpcWaiting && clickedJoin
  const wasWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    wasWaitingRef.current = waiting
  }, [waiting])

  const [showSuccess, setShowSuccess] = React.useState(false)

  React.useEffect(() => {
    setShowSuccess(wasWaitingRef.current && !waiting && !error)
  }, [waiting, error])

  const teamname = (details?.teamName.parts || []).join('.')

  const body =
    details === undefined ? (
      loaded ? (
        <Kb.Box2
          direction="vertical"
          style={styles.center}
          fullWidth={true}
          fullHeight={true}
          gap="small"
          centerChildren={true}
        >
          <Kb.Text type="BodySmallError">ERROR: {error}</Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2
          direction="vertical"
          style={styles.center}
          fullWidth={true}
          fullHeight={true}
          gap="small"
          centerChildren={true}
        >
          <Kb.ProgressIndicator type="Huge" />
          <Kb.Text type="BodySmall">Loading...</Kb.Text>
        </Kb.Box2>
      )
    ) : showSuccess ? (
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
            imageOverrideUrl={details.teamAvatars?.['square_192']}
          />
          {details.teamIsOpen && (
            <Kb.Box2
              direction="horizontal"
              style={styles.meta}
              fullWidth={!Kb.Styles.isMobile}
              centerChildren={true}
            >
              <Kb.Meta backgroundColor={Kb.Styles.globalColors.green} title="open" size="Small" />
            </Kb.Box2>
          )}
        </Kb.Box>
        <Kb.Text type="Header">Join {teamname}</Kb.Text>
        <Kb.Text type="BodySmall">{details.teamNumMembers.toLocaleString()} members</Kb.Text>
        <Kb.Text type="Body" lineClamp={3} style={styles.description}>
          {details.teamDesc}
        </Kb.Text>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          centerChildren={true}
          gap="xtiny"
          style={styles.buttonBar}
        >
          <Kb.Button
            type="Success"
            label="Join team"
            onClick={onJoinTeam}
            style={styles.button}
            waiting={waiting}
          />
          <Kb.Button type="Dim" label="Later" onClick={onClose} style={styles.button} waiting={waiting} />
        </Kb.Box2>
        {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
        <Kb.Box style={Kb.Styles.globalStyles.flexOne} />
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.inviterBox}>
          <Kb.Avatar
            size={16}
            username={details.inviterUsername}
            borderColor={Kb.Styles.isMobile ? Kb.Styles.globalColors.white : undefined}
          />
          <Kb.ConnectedUsernames
            type="BodySmallBold"
            usernames={[details.inviterUsername]}
            colorFollowing={true}
          />
          <Kb.Text type="BodySmall"> invited you.</Kb.Text>
        </Kb.Box2>
        {Kb.Styles.isMobile && (
          <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.laterBox}>
            <Kb.Button label="Later" type="Dim" onClick={onClose} style={styles.button} />
          </Kb.Box2>
        )}
      </Kb.Box2>
    )

  return Kb.Styles.isMobile ? (
    <Kb.MobilePopup overlayStyle={styles.mobileOverlay}>{body}</Kb.MobilePopup>
  ) : (
    <Kb.Modal mode="Wide" allowOverflow={true} noScrollView={true} onClose={onClose}>
      {body}
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatar: Kb.Styles.platformStyles({
        common: {marginBottom: -36, position: 'relative', top: -48},
        isElectron: {paddingTop: 80},
      }),
      body: Kb.Styles.platformStyles({
        common: {
          paddingBottom: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.blueGreyLight,
          borderRadius: 8,
        },
      }),
      button: Kb.Styles.platformStyles({
        isElectron: {width: 360},
        isMobile: {
          flex: 1,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
      buttonBar: {justifyContent: 'center', paddingTop: Kb.Styles.globalMargins.small},
      center: {justifyContent: 'center'},
      description: Kb.Styles.platformStyles({
        isElectron: {width: 460},
        isMobile: Kb.Styles.padding(0, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small),
      }),
      inviterBox: {paddingBottom: Kb.Styles.globalMargins.small},
      laterBox: {
        borderTopColor: Kb.Styles.globalColors.black_10,
        borderTopWidth: 1,
        paddingTop: Kb.Styles.globalMargins.small,
      },
      meta: {
        bottom: -7,
        position: 'absolute',
      },
      mobileOverlay: {
        height: 392,
      },
    }) as const
)

export default JoinFromInvite
