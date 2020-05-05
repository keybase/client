import * as React from 'react'
import * as Constants from '../../constants/push'
import * as PushGen from '../../actions/push-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Container from '../../util/container'

const PushPrompt = () => {
  const dispatch = Container.useDispatch()
  const onNoPermissions = React.useCallback(() => {
    dispatch(PushGen.createRejectPermissions())
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  const onRequestPermissions = React.useCallback(() => {
    dispatch(PushGen.createRequestPermissions())
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        rightButton: (
          <Kb.ClickableBox onClick={onNoPermissions}>
            <Kb.Text type="BodyBig" negative={true}>
              Skip
            </Kb.Text>
          </Kb.ClickableBox>
        ),
        style: styles.header,
        title: (
          <Kb.Text type="Header" lineClamp={1} center={true} negative={true}>
            Allow notifications
          </Kb.Text>
        ),
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
      mobileStyle={styles.background}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        <Kb.Icon type="illustration-turn-on-notifications" style={styles.image} />
        <Kb.Text center={true} type="BodySemibold" negative={true}>
          Notifications are very important.
        </Kb.Text>
        <Kb.Text center={true} type="Body" negative={true}>
          Your device might need to be contacted, for example if you install Keybase on another device. This
          is a crucial security setting.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {backgroundColor: Styles.globalColors.blue},
      button: Styles.platformStyles({
        common: {
          maxHeight: 40,
        },
        isTablet: {
          marginBottom: Styles.globalMargins.medium,
        },
      }),
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
      image: Styles.platformStyles({
        isTablet: {
          alignSelf: 'center',
        },
      }),
    } as const)
)

export default PushPrompt
