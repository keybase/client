import * as React from 'react'
import * as C from '../constants'
import * as Container from '../util/container'
import * as Constants from '../constants/settings'
import * as ConfigConstants from '../constants/config'
import * as Tabs from '../constants/tabs'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {appendNewChatBuilder} from '../actions/typed-routes'
import {SettingsSection} from './account'

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'

const ManageContacts = () => {
  const status = C.useSettingsContactsState(s => s.permissionStatus)
  const contactsImported = C.useSettingsContactsState(s => s.importEnabled)
  const waiting = Container.useAnyWaiting(C.importContactsWaitingKey)

  const loadContactImportEnabled = C.useSettingsContactsState(s => s.dispatch.loadContactImportEnabled)

  if (contactsImported === null) {
    loadContactImportEnabled()
  }

  const requestPermissions = C.useSettingsContactsState(s => s.dispatch.requestPermissions)
  const editContactImportEnabled = C.useSettingsContactsState(s => s.dispatch.editContactImportEnabled)

  const onToggle = React.useCallback(() => {
    if (status !== 'granted') {
      requestPermissions(true, true)
    } else {
      editContactImportEnabled(!contactsImported, true)
    }
  }, [editContactImportEnabled, requestPermissions, contactsImported, status])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.positionRelative}>
      <Kb.BoxGrow>
        <ManageContactsBanner />
        <SettingsSection>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Phone contacts</Kb.Text>
            <Kb.Text type="BodySmall">
              {contactsImported && status === 'granted' ? enabledDescription : disabledDescription}
            </Kb.Text>
            <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
              <Kb.Button
                disabled={status === 'denied'}
                mode="Secondary"
                label={contactsImported && status === 'granted' ? 'Remove contacts' : 'Import phone contacts'}
                type={contactsImported && status === 'granted' ? 'Danger' : 'Default'}
                onClick={onToggle}
                small={true}
                waiting={waiting}
              />
            </Kb.ButtonBar>
          </Kb.Box2>
        </SettingsSection>
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const ManageContactsBanner = () => {
  const status = C.useSettingsContactsState(s => s.permissionStatus)
  const contactsImported = C.useSettingsContactsState(s => s.importEnabled)
  const importedCount = C.useSettingsContactsState(s => s.importedCount)
  const error = C.useSettingsContactsState(s => s.importError)
  const onOpenAppSettings = ConfigConstants.useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onStartChat = React.useCallback(() => {
    switchTab(Tabs.chatTab)
    appendNewChatBuilder()
  }, [switchTab])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSendFeedback = React.useCallback(() => {
    navigateAppend({
      props: {feedback: `Contact import failed\n${error}\n\n`},
      selected: Constants.feedbackTab,
    })
  }, [navigateAppend, error])

  return (
    <>
      {!!importedCount && (
        <Kb.Banner color="green">
          <Kb.BannerParagraph bannerColor="green" content={[`You imported ${importedCount} contacts.`]} />
          <Kb.BannerParagraph bannerColor="green" content={[{onClick: onStartChat, text: 'Start a chat'}]} />
        </Kb.Banner>
      )}
      {(status === 'denied' || (Styles.isAndroid && status !== 'granted' && contactsImported)) && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph
            bannerColor="red"
            content={[
              contactsImported
                ? "Contact importing is paused because Keybase doesn't have permission to access your contacts. "
                : "Keybase doesn't have permission to access your contacts. ",
              {onClick: onOpenAppSettings, text: 'Enable in settings'},
              '.',
            ]}
          />
        </Kb.Banner>
      )}
      {!!error && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content="There was an error importing your contacts." />
          <Kb.BannerParagraph
            bannerColor="red"
            content={[{onClick: onSendFeedback, text: 'Send us feedback.'}]}
          />
        </Kb.Banner>
      )}
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        marginTop: Styles.globalMargins.tiny,
        minHeight: undefined,
        width: undefined,
      },
      positionRelative: {position: 'relative'},
    }) as const
)

export default ManageContacts
