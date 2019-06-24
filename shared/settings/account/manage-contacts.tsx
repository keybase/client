import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SettingsSection} from '.'

type Props = {
  contactsImported: boolean
  onToggleImport: () => void
}

const ManageContacts = (props: Props) => {
  const contactsImported = Container.useSelector(s => s.settings.contactImportEnabled)
  const dispatch = Container.useDispatch()
  // if (contactsImported === null) { TODO
  //   dispatch(SettingsGen.createGetContactImportEnabled())
  // }
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.positionRelative}>
      <Kb.HeaderHocHeader title="Contacts" onBack={onBack} />
      <Kb.BoxGrow>
        <SettingsSection>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Phone Contacts</Kb.Text>
            <Kb.Text type="BodySmall">
              Import your phone contacts and start encrypted chats with your friends. Your contacts never
              leave this device.
            </Kb.Text>
          </Kb.Box2>
          <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
            <Kb.Button
              mode="Secondary"
              label={contactsImported ? 'Remove contacts' : 'Import phone contacts'}
              type={contactsImported ? 'Danger' : 'Default'}
              onClick={() => {}}
              small={true}
            />
          </Kb.ButtonBar>
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
