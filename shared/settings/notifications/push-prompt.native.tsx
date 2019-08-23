import * as React from 'react'
import * as Constants from '../../constants/push'
import * as PushGen from '../../actions/push-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const PushPrompt = () => {
  const dispatch = Container.useDispatch()
  const onRequestPermissions = () => dispatch(PushGen.createRequestPermissions())
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
      <Kb.RequireImage
        resizeMode="stretch"
        style={styles.image}
        src={require('../../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
      />
      <Kb.Text center={true} type="BodySemibold" negative={true}>
        Notifications are very important.
      </Kb.Text>
      <Kb.Text center={true} type="Body" negative={true}>
        Your phone might need to be contacted, for example if you install Keybase on another device. This is a
        crucial security setting.
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonContainer}>
        <Kb.WaitingButton
          fullWidth={true}
          onClick={onRequestPermissions}
          label="Allow notifications"
          waitingKey={Constants.permissionsRequestingWaitingKey}
          style={styles.button}
          type="Success"
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

PushPrompt.navigationOptions = {
  headerHideBorder: true,
  headerLeft: null, // no back button
  headerRightActions: () => {
    const dispatch = Container.useDispatch()
    const onNoPermissions = () => dispatch(PushGen.createRejectPermissions())
    return (
      <Kb.ClickableBox onClick={onNoPermissions}>
        <Kb.Text type="BodyBig" negative={true}>
          Skip
        </Kb.Text>
      </Kb.ClickableBox>
    )
  },
  headerStyle: () => styles.header,
  headerTitle: 'Allow notifications',
}

const styles = Styles.styleSheetCreate(() => ({
  button: {maxHeight: 40},
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.blue,
    padding: Styles.globalMargins.small,
  },
  header: {
    backgroundColor: Styles.globalColors.blue,
  },
  image: {
    height: '55%',
    width: '155%',
  },
}))

export default PushPrompt
