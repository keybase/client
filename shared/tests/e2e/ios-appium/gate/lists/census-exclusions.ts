// Routes, write RPCs and surfaces the iOS release run does not have to reach, each with why. A reason
// starting `manual-only: <id>` names an entry of IOS_MANUAL_ONLY (manual-only.ts): the run stops at
// that edge and a person does the rest.
import type {Exclusions} from '../../../shared/gate/census-lib.ts'

const desktopOnly = 'desktop only: the phone has no such screen'

export const IOS_EXCLUSIONS: Exclusions = {
  routes: {
    kextPermission: `${desktopOnly} (the macOS kernel extension permission popup; Settings > Files shows its entry only on macOS and Windows)`,
    'settingsTabs.screenprotector': 'android only: iOS Settings lists the Screen protector row only on Android',
  },
  rpcs: {
    'keybase.1.config.startUpdateIfNeeded': `${desktopOnly}: the desktop app updater (desktop/renderer/remote-event-handler.desktop.tsx)`,
    'keybase.1.ctl.stop': `${desktopOnly}: the desktop tab bar quit menu and the desktop quit event`,
    'keybase.1.identify3.identify3IgnoreUser': `${desktopOnly}: the desktop tracker popup (tracker/remote-proxy.desktop.tsx)`,
    'keybase.1.install.installFuse': `${desktopOnly}: the FUSE driver install (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.install.installKBFS': `${desktopOnly}: the KBFS install (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.install.uninstallKBFS': `${desktopOnly}: the KBFS uninstall (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.rekey.rekeyStatusFinish': `${desktopOnly}: the desktop unlock-folders window (desktop/renderer/remote-event-handler.desktop.tsx)`,
    'keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed': `${desktopOnly}: the system file manager banner (util/fs-platform.tsx returns on mobile)`,
  },
  surfaces: {
    camera: 'manual-only: camera-capture',
  },
}
