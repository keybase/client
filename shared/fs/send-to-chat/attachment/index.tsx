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
import * as RPCTypes from '../../../constants/types/rpc-gen'
import HiddenString from '../../../util/hidden-string'
import ConversationList from './conversation-list/conversation-list'
import ChooseConversation from './conversation-list/choose-conversation'

type Props = Container.RouteProps<{
  canBack?: boolean
  path?: Types.Path
  incomingShareItems?: Array<RPCTypes.IncomingShareItem>
  useOriginal?: boolean
  url?: string
}>

const isChatText = (item: RPCTypes.IncomingShareItem): boolean =>
  item.type === RPCTypes.IncomingShareType.text && !!item.content

const MobileSendAttachmentToChat = (props: Props) => {
  const canBack = Container.getRouteProps(props, 'canBack', false)
  const incomingShareItems = Container.getRouteProps(props, 'incomingShareItems', undefined)
  const useOriginal = Container.getRouteProps(props, 'useOriginal', false)
  const url = Container.getRouteProps(props, 'url', undefined)
  const path = Container.getRouteProps(props, 'path', undefined)
  const isFromShareExtension = !!Container.getRouteProps(props, 'incomingShareItems', undefined)
  const dispatch = Container.useDispatch()

  const pathsFromIncomingShare = incomingShareItems
    // If it's a chat text, we fill it in the compose box instead of sending it
    // as an attachment.
    ?.filter(item => !isChatText(item))
    ?.map(({originalPath, scaledPath}) =>
      useOriginal ? originalPath ?? '' : scaledPath ?? originalPath ?? ''
    )
    ?.filter(Boolean)
  const pathsFromUrl = url ? [url] : undefined
  const pathsFromPath = path ? [path] : undefined
  const sendPaths = pathsFromIncomingShare || pathsFromUrl || pathsFromPath || []
  const text =
    incomingShareItems
      ?.filter(isChatText)
      ?.map(({content}) => content)
      ?.join(' ') || ''

  const onSelect = (conversationIDKey: ChatTypes.ConversationIDKey, tlfName: string) => {
    text && dispatch(Chat2Gen.createSetPrependText({conversationIDKey, text: new HiddenString(text)}))
    if (sendPaths.length) {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                conversationIDKey,
                pathAndOutboxIDs: sendPaths.map(p => ({
                  outboxID: null,
                  path: p,
                })),
                selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
                tlfName,
              },
              selected: 'chatAttachmentGetTitles',
            },
          ],
        })
      )
    } else {
      dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey,
          reason: isFromShareExtension ? 'extension' : 'files',
        })
      )
    }
  }

  const onCancel = () => dispatch(RouteTreeGen.createClearModals())
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())

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
        title: Constants.getSharePathArrayDescription(sendPaths),
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
  const onSelect = (convID: ChatTypes.ConversationIDKey, convname: string) => {
    setConversationIDKey(convID)
    setConvName(convname)
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
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'files'}))
  }
  return (
    <Kb.PopupWrapper>
      <DesktopSendAttachmentToChatRender
        enabled={conversationIDKey !== ChatConstants.noConversationIDKey}
        convName={convName}
        path={path}
        title={title}
        setTitle={setTitle}
        onSend={onSend}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    </Kb.PopupWrapper>
  )
}

type DesktopSendAttachmentToChatRenderProps = {
  enabled: boolean
  convName: string
  path: Types.Path
  title: string
  setTitle: (title: string) => void
  onSend: () => void
  onCancel: () => void
  onSelect: (convID: ChatTypes.ConversationIDKey, convName: string) => void
}

export const DesktopSendAttachmentToChatRender = (props: DesktopSendAttachmentToChatRenderProps) => {
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

const SendAttachmentToChat = Styles.isMobile ? MobileSendAttachmentToChat : DesktopSendAttachmentToChat

export default SendAttachmentToChat

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
