import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {usePushState} from '@/stores/push'

const PushPrompt = () => {
  const rejectPermissions = usePushState(s => s.dispatch.rejectPermissions)
  const requestPermissions = usePushState(s => s.dispatch.requestPermissions)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onNoPermissions = React.useCallback(() => {
    rejectPermissions()
    clearModals()
  }, [rejectPermissions, clearModals])
  const onRequestPermissions = React.useCallback(() => {
    requestPermissions()
    clearModals()
  }, [requestPermissions, clearModals])
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
            waitingKey={C.waitingKeyPushPermissionsRequesting}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      background: {backgroundColor: Kb.Styles.globalColors.blue},
      button: Kb.Styles.platformStyles({
        common: {
          maxHeight: 40,
        },
        isTablet: {
          marginBottom: Kb.Styles.globalMargins.medium,
        },
      }),
      container: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        backgroundColor: Kb.Styles.globalColors.blue,
        justifyContent: 'center',
        padding: Kb.Styles.globalMargins.small,
      },
      footer: {
        backgroundColor: Kb.Styles.globalColors.blue,
      },
      header: {
        backgroundColor: Kb.Styles.globalColors.blue,
        color: Kb.Styles.globalColors.white,
      },
      image: Kb.Styles.platformStyles({
        isTablet: {
          alignSelf: 'center',
        },
      }),
    }) as const
)

export default PushPrompt
