// @flow
import * as React from 'react'
import * as Constants from '../constants/push'
import * as PushGen from '../actions/push-gen'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import {connect} from '../util/container'

type Props = {
  onRequestPermissions: () => void,
  onNoPermissions: () => void,
  waitingKey: string,
}

const Push = (props: Props) => (
  <Kb.NativeScrollView style={{width: '100%', height: '100%'}}>
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Kb.Box style={{padding: Styles.globalMargins.small, width: '100%'}}>
        <Kb.Text
          type="Header"
          style={{
            marginBottom: Styles.globalMargins.small,
            marginTop: Styles.globalMargins.small,
            textAlign: 'center',
          }}
        >
          Please turn on notifications!
        </Kb.Text>
        <Kb.NativeImage
          style={{height: 200, width: '170%', resizeMode: 'contain'}}
          source={require('../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
        />
        <Kb.Text type="BodySmallSemibold" style={{textAlign: 'center', color: Styles.globalColors.black}}>
          It's{' '}
          <Kb.Text type="BodySmallSemiboldItalic" style={{color: Styles.globalColors.black}}>
            very
          </Kb.Text>{' '}
          important you enable notifications.
        </Kb.Text>
        <Kb.Text
          type="BodySmall"
          style={{
            textAlign: 'center',
            marginTop: Styles.globalMargins.small,
            marginBottom: Styles.globalMargins.small,
            color: Styles.globalColors.black,
          }}
        >
          This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if
          you provision a new device, this phone will be contacted.
        </Kb.Text>
        <Kb.WaitingButton
          type="Primary"
          fullWidth={true}
          style={{marginBottom: 10}}
          onClick={props.onRequestPermissions}
          label="Got it"
          waitingKey={Constants.permissionsRequestingWaitingKey}
        />
        <Kb.Button
          type="Secondary"
          fullWidth={true}
          style={{marginBottom: 10}}
          onClick={props.onNoPermissions}
          label="No thanks"
        />
      </Kb.Box>
    </Kb.Box>
  </Kb.NativeScrollView>
)

const mapStateToProps = () => ({})

export default connect(mapStateToProps, (dispatch: any) => {
  return {
    onNoPermissions: () => dispatch(PushGen.createRejectPermissions()),
    onRequestPermissions: () => dispatch(PushGen.createRequestPermissions()),
    waitingKey: Constants.permissionsRequestingWaitingKey,
  }
})(Push)
