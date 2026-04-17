import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {SettingsSection} from './account'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {settingsFeedbackTab} from '@/constants/settings'
import {openAppSettings} from '@/util/storeless-actions'

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'

const ManageContacts = () => {
  const contactsState = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      editContactImportEnabled: s.dispatch.editContactImportEnabled,
      loadContactImportEnabled: s.dispatch.loadContactImportEnabled,
      requestPermissions: s.dispatch.requestPermissions,
      status: s.permissionStatus,
    }))
  )
  const {contactsImported, editContactImportEnabled, loadContactImportEnabled} = contactsState
  const {requestPermissions, status} = contactsState
  const waiting = C.Waiting.useAnyWaiting(C.importContactsWaitingKey)

  if (contactsImported === undefined) {
    loadContactImportEnabled()
  }

  const onToggle = () => {
    if (status !== 'granted') {
      requestPermissions(true, true)
    } else {
      editContactImportEnabled(!contactsImported, true)
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} relative={true}>
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
  const {contactsImported, error, importedCount, status} = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      error: s.importError,
      importedCount: s.importedCount,
      status: s.permissionStatus,
    }))
  )
  const {appendNewChatBuilder, navigateAppend, switchTab} = C.Router2
  const onStartChat = () => {
    switchTab(C.Tabs.chatTab)
    appendNewChatBuilder()
  }
  const onSendFeedback = () => {
    navigateAppend({
      name: settingsFeedbackTab,
      params: {feedback: `Contact import failed\n${error}\n\n`},
    })
  }

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
              {onClick: openAppSettings, text: 'Enable in settings'},
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
    }) as const
)

export default ManageContacts
