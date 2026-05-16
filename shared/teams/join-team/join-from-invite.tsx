import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {RPCError} from '@/util/errors'
import * as React from 'react'
import {useSafeNavigation} from '@/util/safe-navigation'
import {Success} from './container'

type Props = {
  inviteDetails?: T.RPCGen.InviteLinkDetails
  inviteID?: string
  inviteKey?: string
}

const getInviteError = (error: unknown, missingKey: boolean) => {
  if (error instanceof RPCError) {
    return (
      error.code === T.RPCGen.StatusCode.scteaminvitebadtoken
        ? missingKey
          ? 'Sorry, that invite token is not valid.'
          : 'Sorry, that team name or token is not valid.'
        : error.code === T.RPCGen.StatusCode.scnotfound
          ? 'This invitation is no longer valid, or has expired.'
          : error.desc
    )
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

const getInviteIdentityKey = ({inviteDetails, inviteID = '', inviteKey = ''}: Props) =>
  `${inviteID || inviteDetails?.inviteID || ''}:${inviteKey}`

const JoinFromInvite = (props: Props) => <JoinFromInviteInner key={getInviteIdentityKey(props)} {...props} />

const JoinFromInviteInner = ({inviteDetails: initialInviteDetails, inviteID = '', inviteKey = ''}: Props) => {
  const [details, setDetails] = React.useState(initialInviteDetails)
  const [error, setError] = React.useState('')
  const loaded = details !== undefined || !!error
  const canLoadDetails = details === undefined && !error && !!inviteID
  const canJoin = !!inviteKey
  const missingInviteKeyError = details !== undefined && !canJoin ? 'Sorry, that invite token is not valid.' : ''
  const joinTeam = C.useRPC(T.RPCGen.teamsTeamAcceptInviteOrRequestAccessRpcListener)
  const requestInviteLinkDetails = C.useRPC(T.RPCGen.teamsGetInviteLinkDetailsRpcPromise)
  const [clickedJoin, setClickedJoin] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const rpcWaiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsJoinTeam)
  const waiting = rpcWaiting && clickedJoin

  React.useEffect(() => {
    if (!canLoadDetails) {
      return
    }
    requestInviteLinkDetails(
      [{inviteID}],
      result => {
        setDetails(result)
        setError('')
      },
      rpcError => {
        setError(getInviteError(rpcError, true))
      }
    )
  }, [canLoadDetails, inviteID, requestInviteLinkDetails])

  const nav = useSafeNavigation()

  const onNavUp = () => nav.safeNavigateUp()
  const onJoinTeam = () => {
    if (!canJoin) {
      return
    }
    setClickedJoin(true)
    setError('')
    joinTeam(
      [
        {
          customResponseIncomingCallMap: {
            'keybase.1.teamsUi.confirmInviteLinkAccept': (params, response) => {
              setDetails(params.details)
              response.result(true)
            },
          },
          incomingCallMap: {},
          params: {tokenOrName: inviteKey},
          waitingKey: C.waitingKeyTeamsJoinTeam,
        },
      ],
      () => {
        setClickedJoin(false)
        setShowSuccess(true)
      },
      rpcError => {
        setClickedJoin(false)
        setError(getInviteError(rpcError, false))
      }
    )
  }
  const onClose = () => onNavUp()

  const teamname = (details?.teamName.parts || []).join('.')

  const body =
    details === undefined ? (
      loaded ? (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" centerChildren={true}>
          <Kb.Text type="BodySmallError">ERROR: {error}</Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" centerChildren={true}>
          <Kb.ProgressIndicator type="Huge" />
          <Kb.Text type="BodySmall">Loading...</Kb.Text>
        </Kb.Box2>
      )
    ) : showSuccess ? (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" centerChildren={true}>
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
        <Kb.Box2 direction="vertical" style={styles.avatar}>
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
        </Kb.Box2>
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
            disabled={!canJoin}
            waiting={waiting}
          />
          <Kb.Button type="Dim" label="Later" onClick={onClose} style={styles.button} waiting={waiting} />
        </Kb.Box2>
        {!!(error || missingInviteKeyError) && <Kb.Text type="BodySmallError">{error || missingInviteKeyError}</Kb.Text>}
        <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne} />
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.inviterBox}>
          <Kb.Avatar size={16} username={details.inviterUsername} />
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

  return body
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
      buttonBar: {paddingTop: Kb.Styles.globalMargins.small},
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
    }) as const
)

export default JoinFromInvite
