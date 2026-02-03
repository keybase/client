import * as C from '@/constants'
import * as Chat from '@/constants/chat2'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common'
import ConversationList from './conversation-list/conversation-list'
import ChooseConversation from './conversation-list/choose-conversation'
import {useFSState} from '@/constants/fs'
import * as FS from '@/constants/fs'
import {useCurrentUserState} from '@/constants/current-user'

type Props = {
  canBack?: boolean
  isFromShareExtension?: boolean
  text?: string // incoming share (text)
  sendPaths?: Array<string> // KBFS or incoming share (files)
}

const MobileSendToChatRoutable = (props: Props) => {
  const {canBack, isFromShareExtension, sendPaths, text} = props
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => clearModals()
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
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
        title: FS.getSharePathArrayDescription(sendPaths || []),
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
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const fileContext = useFSState(s => s.fileContext)
  const onSelect = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => {
    const {dispatch} = Chat.getConvoState(conversationIDKey)
    text && dispatch.injectIntoInput(text)
    if (sendPaths?.length) {
      navigateAppend({
        props: {
          conversationIDKey,
          pathAndOutboxIDs: sendPaths.map(p => ({
            path: Kb.Styles.normalizePath(p),
            url: fileContext.get(p)?.url,
          })),
          selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
          tlfName,
        },
        selected: 'chatAttachmentGetTitles',
      })
    } else {
      clearModals()
      dispatch.navigateToThread(isFromShareExtension ? 'extension' : 'files')
    }
  }
  return <ConversationList {...props} onSelect={onSelect} />
}

const noPaths = new Array<string>()
const DesktopSendToChat = (props: Props) => {
  const sendPaths = props.sendPaths ?? noPaths
  const [title, setTitle] = React.useState('')
  const [conversationIDKey, setConversationIDKey] = React.useState(Chat.noConversationIDKey)
  const [convName, setConvName] = React.useState('')
  const username = useCurrentUserState(s => s.username)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    clearModals()
  }
  const onSelect = (convID: T.Chat.ConversationIDKey, convname: string) => {
    setConversationIDKey(convID)
    setConvName(convname)
  }
  const onSend = () => {
    const {dispatch} = Chat.getConvoState(conversationIDKey)
    sendPaths.forEach(path =>
      dispatch.attachmentsUpload(
        [{path: T.FS.pathToString(path)}],
        [title],
        `${username},${convName.split('#')[0]}`
      )
    )
    clearModals()
    Chat.getConvoState(conversationIDKey).dispatch.navigateToThread('files')
  }
  return (
    <Kb.PopupWrapper>
      <DesktopSendToChatRender
        enabled={conversationIDKey !== Chat.noConversationIDKey}
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
  path: T.FS.Path
  title: string
  setTitle: (title: string) => void
  onSend: () => void
  onCancel: () => void
  onSelect: (convID: T.Chat.ConversationIDKey, convName: string) => void
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
            <Kb.Text type="BodySmall">{T.FS.getPathName(props.path)}</Kb.Text>
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

const SendToChat = Kb.Styles.isMobile ? MobileSendToChatRoutable : DesktopSendToChat

export default SendToChat

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      belly: {
        ...Kb.Styles.globalStyles.flexGrow,
        alignItems: 'center',
        marginBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
      },
      buttonBar: {alignItems: 'center'},
      container: Kb.Styles.platformStyles({
        isElectron: {
          maxHeight: 560,
          width: 400,
        },
      }),
      dropdown: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.mediumLarge,
        width: '100%',
      },
      header: {
        paddingTop: Kb.Styles.globalMargins.mediumLarge,
      },
      input: {
        width: '100%',
      },
      pathItem: {
        marginTop: Kb.Styles.globalMargins.mediumLarge,
      },
    }) as const
)
