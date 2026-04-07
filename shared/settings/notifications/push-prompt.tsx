import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {usePushState} from '@/stores/push'

const PushPrompt = () => {
  const requestPermissions = usePushState(s => s.dispatch.requestPermissions)
  const clearModals = C.Router2.clearModals
  const onRequestPermissions = () => {
    requestPermissions()
    clearModals()
  }

  return (
    <>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" justifyContent="center" style={styles.container}>
        <Kb.ImageIcon type="illustration-turn-on-notifications" style={styles.image} />
        <Kb.Text center={true} type="BodySemibold" negative={true}>
          Notifications are very important.
        </Kb.Text>
        <Kb.Text center={true} type="Body" negative={true}>
          Your device might need to be contacted, for example if you install Keybase on another device. This
          is a crucial security setting.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Kb.Styles.collapseStyles([styles.modalFooterNoBorder, styles.footer])}>
          <Kb.WaitingButton
            fullWidth={true}
            onClick={onRequestPermissions}
            label="Allow notifications"
            waitingKey={C.waitingKeyPushPermissionsRequesting}
            style={styles.button}
            type="Success"
          />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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
        padding: Kb.Styles.globalMargins.small,
      },
      footer: {
        backgroundColor: Kb.Styles.globalColors.blue,
      },
      image: Kb.Styles.platformStyles({
        isTablet: {
          alignSelf: 'center',
        },
      }),
      modalFooterNoBorder: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
    }) as const
)

export default PushPrompt
