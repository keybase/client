import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SettingsSection} from '.'

type Props = {
  contactsImported: boolean
  onToggleImport: () => void
}

const enabledDescription = 'Your phone contacts are being synced on this device.'
const disabledDescription =
  'Import your phone contacts and start encrypted chats with your friends. Your contacts never leave this device.'

const ManageContacts = (props: Props) => {
  const contactsImported = Container.useSelector(s => s.settings.contacts.importEnabled)
  const dispatch = Container.useDispatch()
  if (contactsImported === null) {
    dispatch(SettingsGen.createLoadContactImportEnabled())
  }
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onToggle = React.useCallback(
    () => dispatch(SettingsGen.createEditContactImportEnabled({enable: !contactsImported})),
    [dispatch, contactsImported]
  )
  const waiting = Container.useAnyWaiting(Constants.importContactsWaitingKey)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.positionRelative}>
      <Kb.HeaderHocHeader title="Contacts" onBack={onBack} />
      <Kb.BoxGrow>
        <SettingsSection>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Phone Contacts</Kb.Text>
            <Kb.Text type="BodySmall">{contactsImported ? enabledDescription : disabledDescription}</Kb.Text>
            <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
              <Kb.Button
                mode="Secondary"
                label={contactsImported ? 'Remove contacts' : 'Import phone contacts'}
                type={contactsImported ? 'Danger' : 'Default'}
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
    minHeight: undefined,
    width: undefined,
  },
  positionRelative: {position: 'relative'},
})

export default ManageContacts
