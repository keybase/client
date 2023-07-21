import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../../fs/common'
import * as Styles from '../../styles'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ChatConstants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as ConfigConstants from '../../constants/config'
import * as RouterConstants from '../../constants/router2'
import type * as ChatTypes from '../../constants/types/chat2'
import HiddenString from '../../util/hidden-string'
import ConversationList from './conversation-list/conversation-list'
import ChooseConversation from './conversation-list/choose-conversation'

type Props = {
  canBack?: boolean
  isFromShareExtension?: boolean
  text?: string // incoming share (text)
  sendPaths?: Array<string> // KBFS or incoming share (files)
}

const MobileSendToChatRoutable = (props: Props) => {
  const {canBack, isFromShareExtension, sendPaths, text} = props
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onCancel = () => clearModals()
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()

  return (
    <Kb.Modal
      noScrollView={true}
      onClose={canBack ? onBack : onCancel}
      header={{
        leftButton: canBack ? (
          <Kb.Text type="BodyBigLink" onClick={onBack}>
            Back
          </Kb.Text>
        ) : (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ),
        title: Constants.getSharePathArrayDescription(sendPaths || []),
      }}
    >
      <MobileSendToChat
        canBack={canBack}
        isFromShareExtension={isFromShareExtension}
        sendPaths={sendPaths}
        text={text}
      />
    </Kb.Modal>
  )
}

export const MobileSendToChat = (props: Props) => {
  const {isFromShareExtension, sendPaths, text} = props
  const dispatch = Container.useDispatch()

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onSelect = (conversationIDKey: ChatTypes.ConversationIDKey, tlfName: string) => {
    text && dispatch(Chat2Gen.createSetUnsentText({conversationIDKey, text: new HiddenString(text)}))
    if (sendPaths?.length) {
      navigateAppend({
        props: {
          conversationIDKey,
          pathAndOutboxIDs: sendPaths.map(p => ({path: p})),
          selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
          tlfName,
        },
        selected: 'chatAttachmentGetTitles',
      })
    } else {
      dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey,
          reason: isFromShareExtension ? 'extension' : 'files',
        })
      )
    }
  }

  return <ConversationList {...props} onSelect={onSelect} />
}

const noPaths = new Array<string>()
const DesktopSendToChat = (props: Props) => {
  const sendPaths = props.sendPaths ?? noPaths
  const [title, setTitle] = React.useState('')
  const [conversationIDKey, setConversationIDKey] = React.useState(ChatConstants.noConversationIDKey)
  const [convName, setConvName] = React.useState('')
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const dispatch = Container.useDispatch()
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onCancel = () => {
    clearModals()
  }
  const onSelect = (convID: ChatTypes.ConversationIDKey, convname: string) => {
    setConversationIDKey(convID)
    setConvName(convname)
  }
  const onSend = () => {
    sendPaths?.forEach(path =>
      dispatch(
        Chat2Gen.createAttachmentsUpload({
          conversationIDKey,
          paths: [{path: Types.pathToString(path)}],
          titles: [title],
          tlfName: `${username},${convName.split('#')[0]}`,
        })
      )
    )
    clearModals()
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'files'}))
  }
  return (
    <Kb.PopupWrapper>
      <DesktopSendToChatRender
        enabled={conversationIDKey !== ChatConstants.noConversationIDKey}
        convName={convName}
        // If we ever support sending multiples from desktop this will need to
        // change.
        path={sendPaths[0]}
        title={title}
        setTitle={setTitle}
        onSend={onSend}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    </Kb.PopupWrapper>
  )
}

type DesktopSendToChatRenderProps = {
  enabled: boolean
  convName: string
  path: Types.Path
  title: string
  setTitle: (title: string) => void
  onSend: () => void
  onCancel: () => void
  onSelect: (convID: ChatTypes.ConversationIDKey, convName: string) => void
}

export const DesktopSendToChatRender = (props: DesktopSendToChatRenderProps) => {
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
            <Kbfs.ItemIcon size={48} path={props.path} badgeOverride="iconfont-attachment" />
            <Kb.Text type="BodySmall">{Types.getPathName(props.path)}</Kb.Text>
          </Kb.Box2>
          <ChooseConversation
            convName={props.convName}
            dropdownButtonStyle={desktopStyles.dropdown}
            onSelect={props.onSelect}
          />
          <Kb.LabeledInput
            placeholder="Title"
            value={props.title}
            style={desktopStyles.input}
            onChangeText={props.setTitle}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} style={desktopStyles.buttonBar}>
          <Kb.Button type="Dim" label="Cancel" onClick={props.onCancel} />
          <Kb.Button label="Send in conversation" onClick={props.onSend} disabled={!props.enabled} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const SendToChat = Styles.isMobile ? MobileSendToChatRoutable : DesktopSendToChat

export default SendToChat

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
    }) as const
)
