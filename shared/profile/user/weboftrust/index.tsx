import * as React from 'react'
import * as Container from '../../../util/container'
import {formatTimeRelativeToNow} from '../../../util/timestamp'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as UsersGen from '../../../actions/users-gen'
import {WebOfTrustVerificationType} from '../../../constants/types/more'
import {WotReactionType, WotStatusType} from '../../../constants/types/rpc-gen'
import {wotReactWaitingKey, wotRevokeWaitingKey} from '../../../constants/users'

type Props = {
  username: string
  webOfTrustAttestation: {
    attestation: string
    attestingUser: string
    proofID: string
    status: WotStatusType
    verificationType: WebOfTrustVerificationType
    vouchedAt: number
  }
}

const WebOfTrust = (props: Props) => {
  const dispatch = Container.useDispatch()
  const {username, webOfTrustAttestation} = props
  const {attestation, attestingUser, proofID, vouchedAt, status} = webOfTrustAttestation
  const userIsYou = Container.useSelector(state => username === state.config.username)
  const voucherIsYou = Container.useSelector(state => attestingUser === state.config.username)
  const canAccept = userIsYou && status === WotStatusType.proposed
  const onAccept = () => {
    if (!canAccept) return
    dispatch(UsersGen.createWotReact({reaction: WotReactionType.accept, voucher: attestingUser}))
  }
  const canReject = userIsYou && (status === WotStatusType.proposed || status === WotStatusType.accepted)
  const onReject = () => {
    if (!canReject) return
    dispatch(UsersGen.createWotReact({reaction: WotReactionType.reject, voucher: attestingUser}))
  }
  const rejectLabel = status === WotStatusType.proposed ? 'Reject' : 'Delete'
  const canRevoke = voucherIsYou
  const onRevoke = () => {
    if (!canRevoke) return
    dispatch(UsersGen.createSubmitRevokeVouch({proofID, voucheeName: username}))
  }

  let statusStatement = ''
  if (status === WotStatusType.proposed) {
    statusStatement = userIsYou ? 'Pending your approval:' : 'You proposed:'
  } else if (status === WotStatusType.accepted) {
    statusStatement = 'Accepted:'
  }

  return (
    <>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Box2 direction="vertical" style={styles.avatarContainer} centerChildren={true}>
          <Kb.Avatar username={attestingUser} showFollowingStatus={false} size={96} style={styles.avatar} />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textContainer} centerChildren={false}>
          <Kb.Text style={styles.attestationText} type="BodySmall">
            {statusStatement}
          </Kb.Text>
          <Kb.Text style={styles.attestationText} type="Body">
            {attestation}
          </Kb.Text>
          <Kb.Box2 direction="vertical" style={styles.signatureBox} centerChildren={false} fullWidth={true}>
            <Kb.Box2
              direction="horizontal"
              gap="xxtiny"
              centerChildren={true}
              style={styles.innerSignatureBox}
            >
              <Kb.Icon color={Styles.globalColors.blue} type="iconfont-proof-good" sizeType="Small" />
              <Kb.Text type="BodySmall">signed by </Kb.Text>
              <Kb.ConnectedUsernames
                colorBroken={true}
                colorFollowing={true}
                style={styles.username}
                type={Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
                usernames={attestingUser}
              />
              <Kb.Text type="BodySmall">{formatTimeRelativeToNow(vouchedAt)}</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
      {(canAccept || canReject || canRevoke) && (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={false} style={styles.buttonBar}>
          <Kb.ButtonBar align="flex-start">
            {canAccept && (
              <Kb.WaitingButton
                label="Accept"
                onClick={onAccept}
                small={true}
                type="Success"
                waitingKey={wotReactWaitingKey}
              />
            )}
            {canReject && (
              <Kb.WaitingButton
                label={rejectLabel}
                onClick={onReject}
                small={true}
                type="Danger"
                waitingKey={wotReactWaitingKey}
              />
            )}
            {canRevoke && (
              <Kb.WaitingButton
                label="Delete"
                onClick={onRevoke}
                small={true}
                type="Danger"
                waitingKey={wotRevokeWaitingKey}
              />
            )}
          </Kb.ButtonBar>
        </Kb.Box2>
      )}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  attestationText: {alignSelf: 'flex-start'},
  avatar: {marginBottom: Styles.globalMargins.xxtiny},
  avatarContainer: {
    justifyContent: 'space-around',
    padding: Styles.globalMargins.small,
  },
  buttonBar: {
    paddingLeft: Styles.globalMargins.small,
  },
  innerSignatureBox: {alignSelf: 'flex-start'},
  signatureBox: {alignSelf: 'flex-end'},
  textContainer: {
    justifyContent: 'space-around',
    padding: Styles.globalMargins.tiny,
  },
  username: {
    position: 'relative',
    top: -1,
  },
}))

export default WebOfTrust
