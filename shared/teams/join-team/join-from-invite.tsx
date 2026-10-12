import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {RPCError} from '@/util/errors'
import * as React from 'react'
import {useSafeNavigation} from '@/util/safe-navigation'
import Success from './success'

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
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
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

  if (details === undefined) {
    return (
      <Kb.ModalScreen centered={true}>
        {loaded ? (
          <Kb.Text type="BodySmallError">ERROR: {error}</Kb.Text>
        ) : (
          <Kb.Box2 direction="vertical" gap="small" alignItems="center">
            <Kb.ProgressIndicator type="Huge" />
            <Kb.Text type="BodySmall">Loading...</Kb.Text>
          </Kb.Box2>
        )}
      </Kb.ModalScreen>
    )
  }
  if (showSuccess) {
    return (
      <Kb.ModalScreen
        centered={true}
        footer={<Kb.Button type="Dim" label="Close" onClick={onNavUp} fullWidth={true} waiting={waiting} />}
      >
        <Success teamname={teamname} />
      </Kb.ModalScreen>
    )
  }
  return (
    <Kb.ModalScreen
      centered={true}
      footer={
        <Kb.ConfirmButtons
          split={true}
          cancelLabel="Later"
          onCancel={onClose}
          onConfirm={onJoinTeam}
          confirmLabel="Join team"
          confirmType="Success"
          confirmDisabled={!canJoin}
          waiting={waiting}
        />
      }
    >
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="xtiny">
        <Kb.Box2 direction="vertical" style={styles.avatar}>
          <Kb.Avatar
            size={96}
            teamname={teamname}
            isTeam={true}
            imageOverrideUrl={details.teamAvatars?.['square_192']}
          />
          {details.teamIsOpen && (
            <Kb.Box2 direction="horizontal" style={styles.meta} fullWidth={true} centerChildren={true}>
              <Kb.Meta backgroundColor={theme.green} title="open" size="Small" />
            </Kb.Box2>
          )}
        </Kb.Box2>
        <Kb.Text type="BodyBig" center={true} style={styles.teamname}>
          {teamname}
        </Kb.Text>
        <Kb.Text type="BodySmall">{details.teamNumMembers.toLocaleString()} members</Kb.Text>
        <Kb.Text type="Body" lineClamp={3} center={true} style={styles.description}>
          {details.teamDesc}
        </Kb.Text>
        {!!(error || missingInviteKeyError) && (
          <Kb.Text type="BodySmallError">{error || missingInviteKeyError}</Kb.Text>
        )}
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.inviterBox}>
          <Kb.Avatar size={16} username={details.inviterUsername} />
          <Kb.ConnectedUsernames type="BodySmallBold" usernames={[details.inviterUsername]} colorFollowing={true} />
          <Kb.Text type="BodySmall"> invited you.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  avatar: {marginBottom: Kb.Styles.globalMargins.tiny, marginTop: Kb.Styles.globalMargins.small},
  description: {alignSelf: 'stretch', paddingTop: Kb.Styles.globalMargins.tiny},
  inviterBox: {paddingTop: Kb.Styles.globalMargins.small},
  meta: {
    bottom: -7,
    position: 'absolute',
  },
  teamname: Kb.Styles.platformStyles({isElectron: {wordBreak: 'break-word'}}),
}))

export default JoinFromInvite
