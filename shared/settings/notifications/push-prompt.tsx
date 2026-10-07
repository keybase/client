import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {usePushState} from '@/stores/push'

const PushPrompt = () => {
  const styles = useStyles()
  const requestPermissions = usePushState(s => s.dispatch.requestPermissions)
  const clearModals = C.Router2.clearModals
  const onRequestPermissions = () => {
    requestPermissions()
    clearModals()
  }

  return (
    <Kb.ModalScreen
      centered={true}
      style={styles.blueBackground}
      footerDivider={false}
      footer={
        <Kb.WaitingButton
          fullWidth={true}
          onClick={onRequestPermissions}
          label="Allow notifications"
          waitingKey={C.waitingKeyPushPermissionsRequesting}
          style={styles.button}
          type="Success"
        />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
        <Kb.ImageIcon type="illustration-turn-on-notifications" style={styles.image} />
        <Kb.Text center={true} type="BodySemibold" negative={true}>
          Notifications are very important.
        </Kb.Text>
        <Kb.Text center={true} type="Body" negative={true}>
          Your device might need to be contacted, for example if you install Keybase on another device. This
          is a crucial security setting.
        </Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      blueBackground: {backgroundColor: theme.blue},
      button: Kb.Styles.platformStyles({
        common: {
          maxHeight: 40,
        },
        isTablet: {
          marginBottom: Kb.Styles.globalMargins.medium,
        },
      }),
      image: Kb.Styles.platformStyles({
        isTablet: {
          alignSelf: 'center',
        },
      }),
    }) as const
)

export default PushPrompt
