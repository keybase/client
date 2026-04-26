import * as C from '@/constants'
import * as T from '@/constants/types'
import {openURL} from '@/util/misc'
import * as Kb from '@/common-adapters'
import PeopleItem from './item'
import * as Settings from '@/constants/settings'

type OwnProps = {
  appLink?: T.RPCGen.AppLinkType | undefined
  badged: boolean
  confirmLabel?: string | undefined
  dismissAnnouncement: (id: T.RPCGen.HomeScreenAnnouncementID) => void
  dismissable: boolean
  getData: (markViewed?: boolean, force?: boolean) => void
  iconUrl?: string | undefined
  id: T.RPCGen.HomeScreenAnnouncementID
  text: string
  url?: string | undefined
}

const Container = (ownProps: OwnProps) => {
  const {appLink, badged, confirmLabel, dismissAnnouncement, dismissable, getData, iconUrl, id, text, url} =
    ownProps
  const {navigateAppend, switchTab} = C.Router2
  const navigateToInbox = C.Router2.navigateToInbox
  const onConfirm = () => {
    if (url) {
      openURL(url)
    }

    switch (appLink) {
      case T.RPCGen.AppLinkType.people:
        break
      case T.RPCGen.AppLinkType.chat:
        navigateToInbox()
        break
      case T.RPCGen.AppLinkType.files:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.fsTab)
        if (C.isMobile) {
          navigateAppend({name: Settings.settingsFsTab, params: {}})
        }
        break
      case T.RPCGen.AppLinkType.wallet:
        switchTab(C.Tabs.settingsTab)
        if (C.isMobile) {
          navigateAppend({name: Settings.settingsWalletsTab, params: {}})
        }
        break
      case T.RPCGen.AppLinkType.git:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.gitTab)
        if (C.isMobile) {
          navigateAppend({name: Settings.settingsGitTab, params: {}})
        }
        break
      case T.RPCGen.AppLinkType.devices:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.devicesTab)
        if (C.isMobile) {
          navigateAppend({name: Settings.settingsDevicesTab, params: {}})
        }
        break
      case T.RPCGen.AppLinkType.settings:
        switchTab(C.Tabs.settingsTab)
        break
      case T.RPCGen.AppLinkType.teams:
        switchTab(C.Tabs.teamsTab)
        break
      default:
    }
    dismissAnnouncement(id)
    getData(true, true)
  }
  const _onDismiss = () => {
    dismissAnnouncement(id)
    getData(true, true)
  }
  const onDismiss = dismissable ? _onDismiss : undefined

  return (
    <PeopleItem
      badged={badged}
      icon={
        iconUrl ? (
          <Kb.Image src={iconUrl} style={styles.icon} />
        ) : (
          <Kb.ImageIcon type="icon-keybase-logo-80" style={styles.icon} />
        )
      }
    >
      <Kb.Text type="Body">{text}</Kb.Text>
      {(!!confirmLabel || !!onDismiss) && (
        <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true} style={styles.container}>
          {!!confirmLabel && <Kb.Button small={true} label={confirmLabel} onClick={onConfirm} />}
          {!!onDismiss && <Kb.Button small={true} label="Later" onClick={onDismiss} mode="Secondary" />}
        </Kb.Box2>
      )}
    </PeopleItem>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {alignSelf: 'flex-start'},
      icon: {flexShrink: 0, height: 32, width: 32},
    }) as const
)

export default Container
