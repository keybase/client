import * as React from 'react'
import {WebOfTrustVerificationType} from '../../../constants/types/more'
import {WotStatusType} from '../../../constants/types/rpc-gen'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeRelativeToNow} from '../../../util/timestamp'

type Props = {
  attestation: string
  attestingUser: string
  onAccept?: () => void
  onHide?: () => void
  onReject?: () => void
  reactWaitingKey: string
  status: WotStatusType
  userIsYou: boolean
  username: string
  verificationType: WebOfTrustVerificationType
  vouchedAt: number
}

const entry = (props: Props) => (
  <>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.avatarContainer} centerChildren={true}>
        <Kb.Avatar
          size={96}
          username={props.attestingUser}
          style={styles.avatar}
          showFollowingStatus={false}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textContainer} centerChildren={false}>
        <Kb.Text style={styles.attestationText} type="Body">
          {props.attestation}
        </Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.signatureBox} centerChildren={false} fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="xxtiny" centerChildren={true} style={styles.innerSignatureBox}>
            <Kb.Icon color={Styles.globalColors.blue} type="iconfont-proof-good" sizeType="Small" />
            <Kb.Text type="BodySmall">signed by </Kb.Text>
            <Kb.ConnectedUsernames
              type={Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
              usernames={props.attestingUser}
              colorBroken={true}
              colorFollowing={true}
              style={styles.username}
            />
            <Kb.Text type="BodySmall">{formatTimeRelativeToNow(props.vouchedAt)}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
    {(props.onHide || props.onAccept || props.onReject) && (
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={false} style={styles.buttonBar}>
        <Kb.ButtonBar align="flex-start">
          {props.onHide && <Kb.Button label="Hide" small={true} type="Danger" onClick={props.onHide} />}
          {props.onAccept && (
            <Kb.WaitingButton
              label="Accept"
              small={true}
              type="Success"
              onClick={props.onAccept}
              waitingKey={props.reactWaitingKey}
            />
          )}
          {props.onReject && (
            <Kb.WaitingButton
              label="Reject"
              small={true}
              type="Danger"
              onClick={props.onReject}
              waitingKey={props.reactWaitingKey}
            />
          )}
        </Kb.ButtonBar>
      </Kb.Box2>
    )}
  </>
)

const WebOfTrust = (props: Props) => {
  switch (props.status) {
    case WotStatusType.proposed: {
      if (props.userIsYou) {
        return entry(props)
      }
      return null
    }
    case WotStatusType.accepted: {
      return entry(props)
    }
    default: {
      return null
    }
  }
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
