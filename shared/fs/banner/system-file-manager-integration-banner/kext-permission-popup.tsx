import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import {openSecurityPreferencesDesktop as openSecurityPreferencesInPlatform} from '@/util/fs-platform'

const InstallSecurityPrefs = () => {
  const styles = useStyles()
  const errorToActionOrThrow = Kbfs.useFsErrorActionOrThrow()
  const {driverStatus} = Kbfs.useSystemFileManagerIntegration()
  const onCancel = C.Router2.navigateUp
  const openSecurityPrefs = () => {
    const f = async () => {
      try {
        await openSecurityPreferencesInPlatform()
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }

  const autoCancelledRef = React.useRef(false)
  React.useEffect(() => {
    if (autoCancelledRef.current) return
    if (driverStatus.type === T.FS.DriverStatusType.Enabled) {
      autoCancelledRef.current = true
      onCancel()
    }
  }, [driverStatus, onCancel])

  return (
    <Kb.ModalScreen centered={true}>
      <Kb.Box2 direction="vertical" gap="small" alignItems="center" fullWidth={true}>
        <Kb.Text type="Body" center={true}>
          Open your macOS Security & Privacy Settings and follow these steps.
        </Kb.Text>
        <Kb.ImageIcon style={styles.image} type="illustration-security-preferences" />
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Text type="BodyBig" style={styles.numberList} negative={false}>
            •
          </Kb.Text>
          <Kb.Text type="BodySemibold" style={styles.listText}>
            {'Change "Allow applications downloaded from" to "App Store and identified developers"'}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySemiboldLink" onClick={openSecurityPrefs}>
          Open Security & Privacy Settings
        </Kb.Text>
      </Kb.Box2>
      {driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.isEnabling && (
        <Kb.Box2 alignSelf="center" direction="vertical" style={styles.enablingContainer}>
          <Kb.Box2
            direction="vertical"
            gap="small"
            fullWidth={true}
            fullHeight={true}
            centerChildren={true}
          >
            <Kb.ProgressIndicator type="Small" white={true} />
            <Kb.Text type="BodySmall" negative={true}>
              Checking ...
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      )}
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      enablingContainer: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        backgroundColor: theme.black_63,
      },
      image: {maxWidth: '100%'},
      listText: {flexShrink: 1, paddingTop: 1},
      numberList: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.size(20),
          minWidth: 20,
          paddingTop: 1,
          textAlign: 'center',
        },
      }),
    }) as const
)

const InstallSecurityPrefsContainer = () => (
  <Kbfs.SystemFileManagerIntegrationProvider initialKextPermissionError={true}>
    <InstallSecurityPrefs />
  </Kbfs.SystemFileManagerIntegrationProvider>
)

export default InstallSecurityPrefsContainer
