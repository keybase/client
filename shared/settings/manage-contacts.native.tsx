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
import {SettingsSection} from './account'

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription = 'Import your phone contacts and start encrypted chats with your friends.'

const ManageContacts = () => {
  const dispatch = Container.useDispatch()

  const status = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const contactsImported = Container.useSelector(s => s.settings.contacts.importEnabled)
  const waiting = Container.useAnyWaiting(Constants.importContactsWaitingKey)

  if (contactsImported === null) {
    dispatch(SettingsGen.createLoadContactImportEnabled())
  }

  const onToggle = React.useCallback(
    () =>
      dispatch(
        status !== 'granted'
          ? SettingsGen.createRequestContactPermissions({fromSettings: true, thenToggleImportOn: true})
          : SettingsGen.createEditContactImportEnabled({enable: !contactsImported, fromSettings: true})
      ),
    [dispatch, contactsImported, status]
  )

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

ManageContacts.navigationOptions = {
  header: undefined,
  title: 'Contacts',
}

const ManageContactsBanner = () => {
  const dispatch = Container.useDispatch()

  const status = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const contactsImported = Container.useSelector(s => s.settings.contacts.importEnabled)
  const importedCount = Container.useSelector(s => s.settings.contacts.importedCount)
  const error = Container.useSelector(s => s.settings.contacts.importError)

  const onOpenAppSettings = React.useCallback(() => dispatch(ConfigGen.createOpenAppSettings()), [dispatch])
  const onStartChat = React.useCallback(() => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}))
    dispatch(appendNewChatBuilder())
  }, [dispatch])
  const onSendFeedback = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {feedback: `Contact import failed\n${error}\n\n`}, selected: Constants.feedbackTab}],
      })
    )
  }, [dispatch, error])

  return (
    <>
      {!!importedCount && (
        <Kb.Banner color="green">
          <Kb.BannerParagraph bannerColor="green" content={[`You imported ${importedCount} contacts.`]} />
          <Kb.BannerParagraph bannerColor="green" content={[{onClick: onStartChat, text: 'Start a chat'}]} />
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

ManageContacts.navigationOptions = {
  header: undefined,
  title: 'Contacts',
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
    } as const)
)

export default ManageContacts
