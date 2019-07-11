import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Kbfs from '../../common'
import * as Styles from '../../../styles'
import ChooseConversationHOC from './choose-conversation-hoc'
import ConversationList from '../../../chat/conversation-list/conversation-list-container'
import ChooseConversation from '../../../chat/conversation-list/choose-conversation-container'

type Props = {
  onCancel: () => void
  onSetTitle: (title: string) => void
  send?: () => void
  path: Types.Path
  sendAttachmentToChatState: Types.SendAttachmentToChatState
  title: string
}

const MobileWithHeader = Kb.HeaderHoc(ChooseConversationHOC(ConversationList))

const MobileHeader = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={mobileStyles.headerContainer}>
    <Kb.Text type="BodyBigLink" style={mobileStyles.button} onClick={props.onCancel}>
      Cancel
    </Kb.Text>
    <Kb.Box2 direction="horizontal" style={mobileStyles.headerContent} fullWidth={true} centerChildren={true}>
      <Kb.Text type="BodySemibold" style={mobileStyles.filename}>
        {Types.getPathName(props.path)}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Text type="BodyBigLink" style={mobileStyles.button} onClick={props.send}>
      Send
    </Kb.Text>
  </Kb.Box2>
)

const DesktopConversationDropdown = ChooseConversationHOC(ChooseConversation)

const DesktopSendAttachmentToChat = (props: Props) => (
  <>
    <Kb.Box2 direction="vertical" style={desktopStyles.container} centerChildren={true}>
      <Kb.Box2 direction="horizontal" centerChildren={true} style={desktopStyles.header} fullWidth={true}>
        <Kb.Text type="Header">Attach in conversation</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={desktopStyles.belly} fullWidth={true}>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          style={desktopStyles.pathItem}
          gap="tiny"
        >
          <Kbfs.PathItemIcon size={48} path={props.path} badge={Types.PathItemBadgeType.Upload} />
          <Kb.Text type="BodySmall">{Types.getPathName(props.path)}</Kb.Text>
        </Kb.Box2>
        <DesktopConversationDropdown dropdownButtonStyle={desktopStyles.dropdown} />
        <Kb.Input
          floatingHintTextOverride="Title"
          value={props.title}
          inputStyle={desktopStyles.input}
          onChangeText={props.onSetTitle}
          style={desktopStyles.input}
        />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={desktopStyles.footer}
        fullWidth={true}
        gap="tiny"
      >
        <Kb.Button type="Dim" label="Cancel" onClick={props.onCancel} />
        <Kb.Button
          label="Send in conversation"
          onClick={props.send}
          disabled={props.sendAttachmentToChatState !== Types.SendAttachmentToChatState.ReadyToSend}
        />
      </Kb.Box2>
    </Kb.Box2>
  </>
)

const SendAttachmentToChat = Styles.isMobile
  ? (props: Props) => <MobileWithHeader customComponent={<MobileHeader {...props} />} />
  : Kb.HeaderOrPopup(DesktopSendAttachmentToChat)

export default SendAttachmentToChat

const mobileStyles = Styles.styleSheetCreate({
  button: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  filename: {
    textAlign: 'center',
  },
  headerContainer: {
    minHeight: 44,
  },
  headerContent: {
    flex: 1,
    flexShrink: 1,
    padding: Styles.globalMargins.xtiny,
  },
})

const desktopStyles = Styles.styleSheetCreate({
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
