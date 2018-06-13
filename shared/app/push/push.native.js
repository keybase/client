// @flow
import * as React from 'react'
import * as Constants from '../../constants/push'
import * as PushGen from '../../actions/push-gen'
import {connect} from '../../util/container'
import {Box, Button, Text, NativeScrollView, NativeImage, WaitingButton} from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'

type Props = {
  onRequestPermissions: () => void,
  onNoPermissions: () => void,
  waitingKey: string,
}

const Push = (props: Props) => (
  <NativeScrollView style={{width: '100%', height: '100%'}}>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: globalColors.white,
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Box style={{padding: globalMargins.small, width: '100%'}}>
        <Text
          type="Header"
          style={{
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
            textAlign: 'center',
          }}
        >
          Please turn on notifications!
        </Text>
        <NativeImage
          style={{height: 200, width: '170%', resizeMode: 'contain'}}
          source={require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
        />
        <Text type="BodySmallSemibold" style={{textAlign: 'center', color: globalColors.black}}>
          It's{' '}
          <Text type="BodySmallSemiboldItalic" style={{color: globalColors.black}}>
            very
          </Text>{' '}
          important you enable notifications.
        </Text>
        <Text
          type="BodySmall"
          style={{
            textAlign: 'center',
            marginTop: globalMargins.small,
            marginBottom: globalMargins.small,
            color: globalColors.black,
          }}
        >
          This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if
          you provision a new device, this phone will be contacted.
        </Text>
        <WaitingButton
          type="Primary"
          fullWidth={true}
          style={{marginBottom: 10}}
          onClick={props.onRequestPermissions}
          label="Got it"
          waitingKey={Constants.permissionsRequestingWaitingKey}
        />
        <Button
          type="Secondary"
          fullWidth={true}
          style={{marginBottom: 10}}
          onClick={props.onNoPermissions}
          label="No thanks"
        />
      </Box>
    </Box>
  </NativeScrollView>
)

const mapStateToProps = () => ({})

export default connect(
  mapStateToProps,
  (dispatch: any) => {
    return {
      onNoPermissions: () => dispatch(PushGen.createPermissionsNo()),
      onRequestPermissions: () => dispatch(PushGen.createPermissionsRequest()),
      waitingKey: Constants.permissionsRequestingWaitingKey,
    }
  }
)(Push)
