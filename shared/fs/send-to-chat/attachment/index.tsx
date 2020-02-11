import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Kb from '../../../common-adapters'
import * as Kbfs from '../../common'
import * as Styles from '../../../styles'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as ChatConstants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ConversationList from './conversation-list/conversation-list'
import ChooseConversation from './conversation-list/choose-conversation'
import debounce from 'lodash/debounce'

type Props = Container.RouteProps<{path?: Types.Path; url?: string}>

const MobileSendAttachmentToChat = (props: Props) => {
  const path = Container.getRouteProps(props, 'path', undefined) ?? Constants.defaultPath
  const url = Container.getRouteProps(props, 'url', undefined)
  const dispatch = Container.useDispatch()
  const username = Container.useSelector(state => state.config.username)
  const sendPath = url ?? path
  const onSelect = (conversationIDKey: ChatTypes.ConversationIDKey, convName: string) => {
    dispatch(
      Chat2Gen.createAttachmentsUpload({
        conversationIDKey,
        paths: [{outboxID: null, path: Types.pathToString(sendPath)}],
        titles: [''],
        tlfName: `${username},${convName.split('#')[0]}`,
      })
    )
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'files'}))
    dispatch(Chat2Gen.createNavigateToThread())
  }
  const onCancel = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  return (
    <Kb.Modal
      onClose={onCancel}
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" style={mobileStyles.button} onClick={onCancel}>
            Cancel
          </Kb.Text>
        ),
        title: Types.getPathName(path),
      }}
    >
      <ConversationList {...props} onSelect={onSelect} />
    </Kb.Modal>
  )
}

const DesktopSendAttachmentToChat = (props: Props) => {
  const path = Container.getRouteProps(props, 'path', undefined) ?? Constants.defaultPath
  const [title, setTitle] = React.useState('')
  const [conversationIDKey, setConversationIDKey] = React.useState(ChatConstants.noConversationIDKey)
  const [convName, setConvName] = React.useState('')
  const username = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSelect = (convID: ChatTypes.ConversationIDKey, convName: string) => {
    setConversationIDKey(convID)
    setConvName(convName)
  }
  const onSend = () => {
    dispatch(
      Chat2Gen.createAttachmentsUpload({
        conversationIDKey,
        paths: [{outboxID: null, path: Types.pathToString(path)}],
        titles: [title],
        tlfName: `${username},${convName.split('#')[0]}`,
      })
    )
    dispatch(RouteTreeGen.createClearModals())
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'files'}))
    dispatch(Chat2Gen.createNavigateToThread())
  }
  return (
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
            <Kbfs.ItemIcon size={48} path={path} badgeOverride="iconfont-attachment" />
            <Kb.Text type="BodySmall">{Types.getPathName(path)}</Kb.Text>
          </Kb.Box2>
          <ChooseConversation
            convName={convName}
            dropdownButtonStyle={desktopStyles.dropdown}
            onSelect={onSelect}
          />
          <Kb.LabeledInput
            placeholder="Title"
            value={title}
            style={desktopStyles.input}
            onChangeText={debounce(setTitle, 200)}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} style={desktopStyles.buttonBar}>
          <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
          <Kb.Button
            label="Send in conversation"
            onClick={onSend}
            disabled={conversationIDKey === ChatConstants.noConversationIDKey}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const SendAttachmentToChat = Styles.isMobile
  ? MobileSendAttachmentToChat
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
        marginBottom: Styles.globalMargins.small,
        paddingLeft: Styles.globalMargins.large,
        paddingRight: Styles.globalMargins.large,
      },
      buttonBar: {alignItems: 'center'},
      container: Styles.platformStyles({
        isElectron: {
          maxHeight: 560,
          width: 400,
        },
      }),
      dropdown: {
        marginBottom: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.mediumLarge,
        width: '100%',
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
