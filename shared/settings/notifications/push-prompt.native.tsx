import * as React from 'react'
import * as Constants from '../../constants/push'
import * as PushGen from '../../actions/push-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const PushPrompt = () => {
  const dispatch = Container.useDispatch()
  const onNoPermissions = () => dispatch(PushGen.createRejectPermissions())
  const onRequestPermissions = () => dispatch(PushGen.createRequestPermissions())
  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        negative: true,
        rightButton: (
          <Kb.ClickableBox onClick={onNoPermissions}>
            <Kb.Text type="BodyBig" negative={true}>
              Skip
            </Kb.Text>
          </Kb.ClickableBox>
        ),
        style: styles.header,
        title: 'Allow notifications',
      }}
      footer={{
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            onClick={onRequestPermissions}
            label="Allow notifications"
            waitingKey={Constants.permissionsRequestingWaitingKey}
            style={styles.button}
            type="Success"
          />
        ),
        hideBorder: true,
        style: styles.footer,
      }}
    >
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
          Your phone might need to be contacted, for example if you install Keybase on another device. This is
          a crucial security setting.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {maxHeight: 40},
  container: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.blue,
    justifyContent: 'center',
    padding: Styles.globalMargins.small,
  },
  footer: {
    backgroundColor: Styles.globalColors.blue,
  },
  header: {
    backgroundColor: Styles.globalColors.blue,
    color: Styles.globalColors.white,
  },
  image: {
    flex: 1,
    width: '150%',
  },
}))

export default PushPrompt
