import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useFSState} from '@/stores/fs'

const InstallSecurityPrefs = () => {
  const driverStatus = useFSState(s => s.sfmi.driverStatus)
  const openSecurityPreferencesDesktop = useFSState(s => s.dispatch.defer.openSecurityPreferencesDesktop)
  const onCancel = C.useRouterState(s => s.dispatch.navigateUp)
  const openSecurityPrefs = React.useCallback(
    () => openSecurityPreferencesDesktop?.(),
    [openSecurityPreferencesDesktop]
  )

  const autoCancelledRef = React.useRef(false)
  React.useEffect(() => {
    if (autoCancelledRef.current) return
    if (driverStatus.type === T.FS.DriverStatusType.Enabled) {
      autoCancelledRef.current = true
      onCancel()
    }
  }, [driverStatus, onCancel])

  return (
    <Kb.PopupWrapper onCancel={onCancel}>
      <>
        <Kb.Box2 direction="vertical" gap="small" centerChildren={true} style={styles.container}>
          <Kb.Text type="HeaderBig" style={styles.title}>
            You need to change your system security preferences.
          </Kb.Text>
          <Kb.Text type="Body">Open your macOS Security & Privacy Settings and follow these steps.</Kb.Text>
          <Kb.Box2 direction="horizontal">
            <Kb.Box style={styles.illustrationContainer}>
              <Kb.Icon style={styles.image} type="illustration-security-preferences" />
            </Kb.Box>
            <Kb.Box2 direction="vertical" fullHeight={true} style={styles.numberListContainer}>
              <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
                <Kb.Text type="BodyBig" style={styles.numberList} negative={false}>
                  •
                </Kb.Text>
                <Kb.Text type="BodySemibold" style={styles.listText}>
                  {'Change "Allow applications downloaded from" to "App Store and identified developers"'}
                </Kb.Text>
              </Kb.Box>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Text type="BodySemiboldLink" onClick={openSecurityPrefs}>
            Open Security & Privacy Settings
          </Kb.Text>
        </Kb.Box2>
        {driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.isEnabling && (
          <Kb.Box style={styles.enablingContainer}>
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
          </Kb.Box>
        )}
      </>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        maxWidth: 700,
        minWidth: 700,
        paddingBottom: Kb.Styles.globalMargins.mediumLarge,
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
        paddingTop: Kb.Styles.globalMargins.mediumLarge,
        width: 700,
      },
      enablingContainer: {
        backgroundColor: Kb.Styles.globalColors.black_63,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      highlight: {
        backgroundColor: Kb.Styles.globalColors.black_05,
        borderColor: Kb.Styles.globalColors.blue,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 2,
        position: 'absolute',
      },
      illustrationContainer: {
        position: 'relative',
      },
      image: {
        width: 408,
      },
      listText: {
        paddingBottom: 16,
        paddingTop: 1,
      },
      numberList: Kb.Styles.platformStyles({
        isElectron: {
          height: 20,
          minWidth: 20,
          paddingTop: 1,
          textAlign: 'center',
          width: 20,
        },
      }),
      numberListContainer: {paddingTop: Kb.Styles.globalMargins.large},
      title: {
        maxWidth: 480,
        textAlign: 'center',
      },
    }) as const
)

export default InstallSecurityPrefs
