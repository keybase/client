import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const PushPrompt = () => {
  const rejectPermissions = C.usePushState(s => s.dispatch.rejectPermissions)
  const requestPermissions = C.usePushState(s => s.dispatch.requestPermissions)
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
            waitingKey={C.permissionsRequestingWaitingKey}
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
    }) as const
)

export default PushPrompt
