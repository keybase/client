import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {openMacfuseSiteDesktop} from '@/util/fs-platform'
import {useFsErrorActionOrThrow} from './error-state'
import {useSystemFileManagerIntegration} from './sfmi'

type MacfuseAction = 'openSite' | 'showKextHelp'

export type MacfusePromptCopy = {
  // banner title
  title: string
  // popup and Settings heading
  label: string
  body: string
  actionLabel: string
  action: MacfuseAction
}

// Shown where the user turns Finder access on: the first mount triggers macOS's one-time privacy prompt
// for the kbfs binary, and KBFS cannot serve the volume until it is allowed.
const macfuseNetworkVolumeNote =
  'macOS will ask once whether "kbfs" may access files on a network volume — click Allow.'

// The copy for a macOS Disabled status that cannot be enabled yet; undefined when it can.
export const macfusePromptCopy = (status: T.FS.DriverStatusDisabled): MacfusePromptCopy | undefined => {
  if (status.kextPermissionError) {
    return {
      action: 'showKextHelp',
      actionLabel: 'How to allow macFUSE',
      body: "macFUSE is installed, but macOS hasn't allowed its system extension yet.",
      label: 'Allow macFUSE',
      title: 'Allow macFUSE',
    }
  }
  switch (status.macfuse) {
    case T.FS.MacfuseState.NotInstalled:
      return {
        action: 'openSite',
        actionLabel: 'Install macFUSE',
        body: 'Keybase can show your files in Finder with macFUSE, a free add-on you install yourself. Keybase works fine without it. After installing, come back here.',
        label: 'Set up Finder access',
        title: 'Use Keybase in Finder',
      }
    case T.FS.MacfuseState.Outdated:
      return {
        action: 'openSite',
        actionLabel: 'Update macFUSE',
        body: `Keybase needs macFUSE 5 or newer to show your files in Finder. You have macFUSE ${status.macfuseVersion}.`,
        label: 'Update macFUSE',
        title: 'Update macFUSE',
      }
    case T.FS.MacfuseState.UnsupportedMacos:
      return {
        action: 'openSite',
        actionLabel: 'Update macFUSE',
        body: `${status.macfuseVersion ? `macFUSE ${status.macfuseVersion}` : 'This macFUSE'} doesn't support ${status.macosVersion ? `macOS ${status.macosVersion}` : 'this version of macOS'}, which usually happens after a macOS update. Update macFUSE to keep using Keybase in Finder.`,
        label: 'Update macFUSE',
        title: 'Update macFUSE',
      }
    case T.FS.MacfuseState.Error:
      return {
        action: 'openSite',
        actionLabel: 'Reinstall macFUSE',
        body: `macFUSE is installed but Keybase can't use it: ${status.macfuseError}`,
        label: "Can't use macFUSE",
        title: "Can't use macFUSE",
      }
    case T.FS.MacfuseState.Ready:
      return undefined
  }
}

export const useMacfuseAction = (action: MacfuseAction) => {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  return () => {
    if (action === 'showKextHelp') {
      C.Router2.navigateAppend({name: 'kextPermission', params: {}})
      return
    }
    const f = async () => {
      try {
        await openMacfuseSiteDesktop()
      } catch (error) {
        errorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  }
}

type Props = {
  copy: MacfusePromptCopy
  // called after the action runs, e.g. to close the popup holding the prompt
  onAction?: () => void
  variant: 'popup' | 'settings'
}

const MacfusePrompt = ({copy, onAction, variant}: Props) => {
  const styles = useStyles()
  const {action, actionLabel, body, label} = copy
  const runAction = useMacfuseAction(action)
  const onClick = () => {
    runAction()
    onAction?.()
  }
  return variant === 'popup' ? (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="tiny" style={styles.popup}>
      <Kb.Text type="BodyBig" center={true}>
        {label}
      </Kb.Text>
      <Kb.Text type="BodySmall" center={true}>
        {body}
      </Kb.Text>
      <Kb.Button label={actionLabel} onClick={onClick} style={styles.popupButton} />
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Text type="BodySemibold">{label}</Kb.Text>
      <Kb.Text type="BodySmall">{body}</Kb.Text>
      <Kb.Text type="BodySmallPrimaryLink" onClick={onClick}>
        {actionLabel}
      </Kb.Text>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  popup: Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.tiny),
  popupButton: {marginTop: Kb.Styles.globalMargins.tiny},
}))

export default MacfusePrompt

const mountPendingNote = `Keybase is not in ${C.fileUIName} yet. If macOS asked whether "kbfs" may access files on a network volume, click Allow. If you clicked Don't Allow, allow "kbfs" under Network Volumes in System Settings › Privacy & Security › Files & Folders.`

// The note shown wherever an enable can start: once an enable stopped waiting for the mount, how to allow kbfs;
// otherwise on macOS, the heads-up about the network volume prompt. Both cover the same Allow step.
export const useEnableNote = (): string | undefined => {
  const {mountPending} = useSystemFileManagerIntegration()
  return mountPending ? mountPendingNote : C.isDarwin ? macfuseNetworkVolumeNote : undefined
}
