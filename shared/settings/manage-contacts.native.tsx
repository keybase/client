import * as React from 'react'
import * as Container from '../util/container'
import * as Constants from '../constants/settings'
import * as Tabs from '../constants/tabs'
import * as SettingsGen from '../actions/settings-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {appendNewChatBuilder} from '../actions/typed-routes'
import {SettingsSection} from './account/'

type Props = {
  contactsImported: boolean
  onToggleImport: () => void
}

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'

const ManageContacts = (_: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const status = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const contactsImported = Container.useSelector(s => s.settings.contacts.importEnabled)
  const importedCount = Container.useSelector(s => s.settings.contacts.importedCount)
  const waiting = Container.useAnyWaiting(Constants.importContactsWaitingKey)

  if (contactsImported === null) {
    dispatch(SettingsGen.createLoadContactImportEnabled())
  }

  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onToggle = React.useCallback(
    () =>
      dispatch(
        status !== 'granted'
          ? SettingsGen.createRequestContactPermissions({thenToggleImportOn: true})
          : SettingsGen.createEditContactImportEnabled({enable: !contactsImported})
      ),
    [dispatch, contactsImported, status]
  )
  const onOpenAppSettings = React.useCallback(() => dispatch(ConfigGen.createOpenAppSettings()), [dispatch])
  const onStartChat = React.useCallback(() => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}))
    dispatch(appendNewChatBuilder())
  }, [dispatch])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.positionRelative}>
      <Kb.HeaderHocHeader title="Contacts" onBack={onBack} />
      <Kb.BoxGrow>
        {importedCount !== null && (
          <Kb.Banner color="green">
            <Kb.BannerParagraph bannerColor="green" content={[`You imported ${importedCount} contacts.`]} />
            <Kb.BannerParagraph
              bannerColor="green"
              content={[{onClick: onStartChat, text: 'Start a chat'}]}
            />
          </Kb.Banner>
        )}
        {(status === 'never_ask_again' || (Styles.isAndroid && status !== 'granted' && contactsImported)) && (
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
        <SettingsSection>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Phone contacts</Kb.Text>
            <Kb.Text type="BodySmall">
              {contactsImported && status === 'granted' ? enabledDescription : disabledDescription}
            </Kb.Text>
            <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
              <Kb.Button
                disabled={status === 'never_ask_again'}
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

const styles = Styles.styleSheetCreate({
  buttonBar: {
    marginTop: Styles.globalMargins.tiny,
    minHeight: undefined,
    width: undefined,
  },
  positionRelative: {position: 'relative'},
})

export default ManageContacts
