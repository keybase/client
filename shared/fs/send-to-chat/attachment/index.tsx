import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Kbfs from '../../common'
import * as Styles from '../../../styles'
import * as FsGen from '../../../actions/fs-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
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

const useConversationList = () => {
  const sendAttachmentToChat = Container.useSelector(state => state.fs.sendAttachmentToChat)
  const dispatch = Container.useDispatch()
  const onSelect = (convID: ChatTypes.ConversationIDKey) => {
    dispatch(FsGen.createSetSendAttachmentToChatConvID({convID}))
  }
  const onDone = React.useCallback(() => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})), [
    dispatch,
  ])
  const onSetFilter = (filter: string) => {
    dispatch(FsGen.createSetSendAttachmentToChatFilter({filter}))
    dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(filter)}))
  }
  React.useEffect(() => onDone, [onDone])
  return {
    filter: sendAttachmentToChat.filter,
    onDone,
    onSelect,
    onSetFilter,
    selected: sendAttachmentToChat.convID,
  }
}

const ConnectedConversationList = (props: {customComponent?: React.ReactNode | null}) => {
  const additionalProps = useConversationList()
  return <ConversationList {...props} {...additionalProps} />
}

const MobileWithHeader = Kb.HeaderHoc(ConnectedConversationList)

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

const DesktopConversationDropdown = (props: {dropdownButtonStyle?: Styles.StylesCrossPlatform | null}) => {
  const additionalProps = useConversationList()
  return <ChooseConversation {...props} {...additionalProps} />
}

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
          <Kbfs.ItemIcon size={48} path={props.path} badgeOverride="iconfont-attachment" />
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

const mobileStyles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)

const desktopStyles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)
