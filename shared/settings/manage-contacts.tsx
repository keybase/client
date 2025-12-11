import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SettingsSection} from './account'
import {useSettingsContactsState} from '@/constants/settings-contacts'
import {settingsFeedbackTab} from '@/constants/settings'
import {useConfigState} from '@/constants/config'

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'

const ManageContacts = () => {
  const status = useSettingsContactsState(s => s.permissionStatus)
  const contactsImported = useSettingsContactsState(s => s.importEnabled)
  const waiting = C.Waiting.useAnyWaiting(C.importContactsWaitingKey)

  const loadContactImportEnabled = useSettingsContactsState(s => s.dispatch.loadContactImportEnabled)

  if (contactsImported === undefined) {
    loadContactImportEnabled()
  }

  const requestPermissions = useSettingsContactsState(s => s.dispatch.requestPermissions)
  const editContactImportEnabled = useSettingsContactsState(s => s.dispatch.editContactImportEnabled)

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
  const status = useSettingsContactsState(s => s.permissionStatus)
  const contactsImported = useSettingsContactsState(s => s.importEnabled)
  const importedCount = useSettingsContactsState(s => s.importedCount)
  const error = useSettingsContactsState(s => s.importError)
  const onOpenAppSettings = useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const onStartChat = React.useCallback(() => {
    switchTab(C.Tabs.chatTab)
    appendNewChatBuilder()
  }, [appendNewChatBuilder, switchTab])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSendFeedback = React.useCallback(() => {
    navigateAppend({
      props: {feedback: `Contact import failed\n${error}\n\n`},
      selected: settingsFeedbackTab,
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
      {(status === 'denied' || (Kb.Styles.isAndroid && status !== 'granted' && contactsImported)) && (
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        marginTop: Kb.Styles.globalMargins.tiny,
        minHeight: undefined,
        width: undefined,
      },
      positionRelative: {position: 'relative'},
    }) as const
)

export default ManageContacts
