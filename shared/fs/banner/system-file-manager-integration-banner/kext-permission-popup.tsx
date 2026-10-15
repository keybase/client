import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import {isAppleSilicon} from '@/constants/platform'
import {openSecurityPreferencesDesktop as openSecurityPreferencesInPlatform} from '@/util/fs-platform'

const allowSteps = [
  'Open System Settings › Privacy & Security.',
  "Under Security, click Allow next to the message about system software from macFUSE's developer.",
  'Restart your Mac if asked.',
]

// Apple silicon needs a one-time Recovery step before any third-party kext can load
const reducedSecuritySteps = [
  'Shut down your Mac.',
  'Press and hold the power button until "Loading startup options" appears, then choose Options › Continue.',
  'Choose Utilities › Startup Security Utility, select your startup disk, and click Security Policy.',
  'Choose Reduced Security, check "Allow user management of kernel extensions from identified developers", click OK and restart.',
]

const StepList = ({steps}: {steps: ReadonlyArray<string>}) => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      {steps.map((step, idx) => (
        <Kb.Box2 key={idx} direction="horizontal" fullWidth={true}>
          <Kb.Text type="BodySemibold" style={styles.stepNumber}>
            {`${idx + 1}.`}
          </Kb.Text>
          <Kb.Text type="Body" style={styles.stepText}>
            {step}
          </Kb.Text>
        </Kb.Box2>
      ))}
    </Kb.Box2>
  )
}

const KextPermission = () => {
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

  const kextError = driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.kextPermissionError
  const enabled = driverStatus.type === T.FS.DriverStatusType.Enabled
  // Unknown while KBFS reconnects; the kext error comes back with the next status
  const unknown = driverStatus.type === T.FS.DriverStatusType.Unknown
  const sawKextErrorRef = React.useRef(false)
  const autoCancelledRef = React.useRef(false)
  React.useEffect(() => {
    if (autoCancelledRef.current || unknown) return
    if (kextError) {
      sawKextErrorRef.current = true
      return
    }
    if (enabled || sawKextErrorRef.current) {
      autoCancelledRef.current = true
      onCancel()
    }
  }, [kextError, enabled, unknown, onCancel])

  return (
    <Kb.ModalScreen>
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
        <Kb.Text type="Body">
          macFUSE is installed, but macOS hasn&apos;t allowed its system extension yet. macOS may also have
          shown a &quot;System Extension Blocked&quot; message.
        </Kb.Text>
        {isAppleSilicon ? (
          <>
            <Kb.Text type="BodySemibold">First, once on this Mac:</Kb.Text>
            <StepList steps={reducedSecuritySteps} />
            <Kb.Text type="BodySemibold">Then:</Kb.Text>
          </>
        ) : null}
        <StepList steps={allowSteps} />
        <Kb.Text type="BodySemiboldLink" onClick={openSecurityPrefs}>
          Open Privacy & Security
        </Kb.Text>
        <Kb.Text type="BodySmall">This page updates when you come back to Keybase.</Kb.Text>
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
      stepNumber: {minWidth: Kb.Styles.globalMargins.medium},
      stepText: {flexShrink: 1},
    }) as const
)

export default KextPermission
