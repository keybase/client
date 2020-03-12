import * as React from 'react'
import * as Types from '../../../constants/types/profile'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  attestation: string
  attestingUser: string
  dateString: string
  onAccept?: () => void
  onHide?: () => void
  onReject?: () => void
  pending: boolean
  verificationType: Types.WebOfTrustVerificationType
}

const WebOfTrust = (props: Props) => (
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
          <Kb.Box2
            direction="horizontal"
            gap="xxtiny"
            centerChildren={true}
            style={{alignSelf: 'flex-start'}}
          >
            <Kb.Icon color={Styles.globalColors.blue} type="iconfont-proof-good" sizeType="Small" />
            <Kb.Text type="BodySmall">signed by </Kb.Text>
            <Kb.ConnectedUsernames
              type={Styles.isMobile ? 'BodySmallBold' : 'BodyBold'}
              usernames={props.attestingUser}
              colorBroken={true}
              colorFollowing={true}
              style={styles.username}
            />
            <Kb.Text type="BodySmall">{props.dateString}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
    {(props.onHide || props.onAccept || props.onReject) && (
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={false} style={styles.buttonBar}>
        <Kb.ButtonBar align="flex-start">
          {props.onHide && <Kb.Button label="Hide" small={true} type="Danger" onClick={props.onHide} />}
          {props.onAccept && (
            <Kb.Button label="Accept" small={true} type="Success" onClick={props.onAccept} />
          )}
          {props.onReject && <Kb.Button label="Reject" small={true} type="Danger" onClick={props.onReject} />}
        </Kb.ButtonBar>
      </Kb.Box2>
    )}
  </>
)

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
