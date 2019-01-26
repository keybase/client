// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import ChooseConversation from '../../chat/conversation-list/choose-conversation'
import type {Props} from '.'

const SendAttachmentToChat = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.header} fullWidth={true}>
      <Kb.Text type="Header">Attach in conversation</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.belly} fullWidth={true}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.pathItem} gap="tiny">
        <Kbfs.PathItemIcon size={48} path={props.path} badge="upload" />
        <Kb.Text type="BodySmall">{Types.getPathName(props.path)}</Kb.Text>
      </Kb.Box2>
      <ChooseConversation dropdownButtonDefaultText="Attach in ..." dropdownButtonStyle={styles.dropdown} />
      <Kb.Input
        floatingHintTextOverride="Title"
        value={Types.getPathName(props.path)}
        inputStyle={styles.input}
        style={styles.input}
      />
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.footer} fullWidth={true} gap="tiny">
      <Kb.Button type="Secondary" label="Cancel" />
      <Kb.Button type="Primary" label="Send in conversation" />
    </Kb.Box2>
  </Kb.Box2>
)

export default Kb.HeaderOrPopup(SendAttachmentToChat)

const styles = Styles.styleSheetCreate({
  belly: {
    ...Styles.globalStyles.flexGrow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 480,
      width: 560,
    },
  }),
  dropdown: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.mediumLarge,
  },
  footer: {
    paddingBottom: Styles.globalMargins.large,
  },
  header: {
    paddingTop: Styles.globalMargins.mediumLarge,
  },
  input: {
    width: '100%',
  },
  pathItem: {
    marginTop: Styles.globalMargins.mediumLarge,
  },
})
