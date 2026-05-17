import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import logger from '@/logger'
import {useConversationMessage} from './data-hooks'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey; messageID: T.Chat.MessageID}

type PickerState = 'picker' | 'title'

const forwardMessageHandoff = new Map<string, T.Chat.Message>()
const forwardMessageKey = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) =>
  `${conversationIDKey}:${T.Chat.messageIDToNumber(messageID)}`

const getForwardMessage = (conversationIDKey: T.Chat.ConversationIDKey, messageID: T.Chat.MessageID) => {
  const key = forwardMessageKey(conversationIDKey, messageID)
  return forwardMessageHandoff.get(key)
}

export const showForwardMessagePicker = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.Message | undefined
) => {
  if (!message || !T.Chat.messageIDToNumber(message.id)) {
    logger.warn('showForwardMessagePicker: no message id')
    return
  }
  const key = forwardMessageKey(conversationIDKey, message.id)
  forwardMessageHandoff.set(key, message)
  C.Router2.navigateAppend({
    name: 'chatForwardMsgPick',
    params: {conversationIDKey, messageID: message.id},
  })
}

const TeamPickerInner = (props: Props) => {
  const srcConvID = props.conversationIDKey ?? Chat.noConversationIDKey
  const messageID = props.messageID
  const handoffKey = forwardMessageKey(srcConvID, messageID)
  const [initialMessage] = React.useState(() => getForwardMessage(srcConvID, messageID))
  const loadedMessage = useConversationMessage(srcConvID, messageID)
  const message = loadedMessage ?? initialMessage
  const navigation = useNavigation()
  const [pickerState, setPickerState] = React.useState<PickerState>('picker')
  const [term, setTerm] = React.useState('')
  const setSearchTerm = C.useDebouncedCallback(setTerm, 200)
  const dstConvIDRef = React.useRef<Uint8Array | undefined>(undefined)
  const [results, setResults] = React.useState<ReadonlyArray<T.RPCChat.ConvSearchHit>>([])
  const [loadedTerm, setLoadedTerm] = React.useState<string>()
  const [error, setError] = React.useState('')
  const waiting = loadedTerm !== term
  const fwdMsg = C.useRPC(T.RPCChat.localForwardMessageNonblockRpcPromise)
  const submit = C.useRPC(T.RPCChat.localForwardMessageConvSearchRpcPromise)

  React.useEffect(() => {
    forwardMessageHandoff.delete(handoffKey)
  }, [handoffKey])

  React.useEffect(() => {
    let stale = false
    submit(
      [{term}],
      result => {
        if (stale) return
        setLoadedTerm(term)
        setError('')
        setResults(result ?? [])
      },
      error => {
        if (stale) return
        setLoadedTerm(term)
        setError('Something went wrong, please try again.')
        logger.info('TeamPicker: error loading search results: ' + error.message)
      }
    )
    return () => {
      stale = true
    }
  }, [submit, term])

  const clearModals = C.Router2.clearModals
  const onClose = () => {
    clearModals()
  }

  const [title, setTitle] = React.useState('')

  let preview: React.ReactNode = (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.ImageIcon type="icon-file-uploading-48" />
    </Kb.Box2>
  )

  if (message?.type === 'attachment') {
    switch (message.attachmentType) {
      case 'image':
        if (message.inlineVideoPlayable) {
          const url = `${message.fileURL}&contentforce=true`
          preview = url ? <Kb.Video autoPlay={false} allowFile={true} url={url} muted={true} /> : null
        } else {
          const src = message.fileURL || message.previewURL
          preview = src ? <Kb.ZoomableImage src={src} style={styles.image} boxCacheKey="fwdimg" /> : null
        }
        break
      default:
        // heics
        if (Chat.isImageViewable(message)) {
          const src = message.fileURL || message.previewURL
          preview = src ? <Kb.ZoomableImage src={src} style={styles.image} boxCacheKey="fwdheics" /> : null
        }
    }
  }

  const previewConversation = C.Router2.previewConversation
  const onSubmit = (event?: React.BaseSyntheticEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!dstConvIDRef.current || !message) return
    previewConversation({
      conversationIDKey: T.Chat.conversationIDToKey(dstConvIDRef.current),
      reason: 'forward',
    })
    fwdMsg(
      [
        {
          dstConvID: dstConvIDRef.current,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          msgID: message.id,
          srcConvID: T.Chat.keyToConversationID(srcConvID),
          title,
        },
      ],
      () => {},
      error => {
        logger.info('TeamPicker: error forwarding message: ' + error.message)
      }
    )
    clearModals()
  }

  const onSelect = (dstConvID: T.RPCChat.ConversationID) => {
    if (!message) {
      setError('Something went wrong, please try again.')
      return
    }

    dstConvIDRef.current = dstConvID

    if (message.type === 'attachment') {
      setPickerState('title')
    } else {
      onSubmit()
    }
  }

  const renderResult = (index: number, item: T.RPCChat.ConvSearchHit) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => onSelect(item.convID)}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.results}>
          {item.isTeam ? (
            <TeamAvatar
              isHovered={false}
              isMuted={false}
              isSelected={false}
              teamname={item.name.split('#')[0] ?? ''}
            />
          ) : (
            <Avatars participantOne={item.parts?.[0]} participantTwo={item.parts?.[1]} />
          )}
          <Kb.Text type="Body" style={{alignSelf: 'center'}}>
            {item.name}
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }

  const showError = !waiting && error.length > 0
  const content =
    pickerState === 'picker' ? (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search chats and teams...`}
            placeholderCentered={true}
            onChange={setSearchTerm}
            style={styles.searchFilter}
            focusOnMount={true}
            waiting={waiting}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          {showError ? (
            <Kb.Text type="Body" style={{alignSelf: 'center', color: Kb.Styles.globalColors.redDark}}>
              {error}
            </Kb.Text>
          ) : (
            <Kb.List
              indexAsKey={true}
              items={results}
              itemHeight={{sizeType: 'Large', type: 'fixedListItemAuto'}}
              renderItem={renderResult}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        <Kb.BoxGrow2 style={styles.boxGrow}>{preview}</Kb.BoxGrow2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
          <Kb.Input3
            containerStyle={styles.input}
            autoFocus={true}
            autoCorrect={true}
            placeholder="Add a caption..."
            onEnterKeyDown={onSubmit}
            onChangeText={setTitle}
            value={title}
            selectTextOnFocus={true}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {isMobile ? null : (
            <Kb.Button fullWidth={true} type="Dim" onClick={onClose} label="Cancel" />
          )}
          <Kb.Button fullWidth={true} onClick={onSubmit} label="Send" />
        </Kb.ButtonBar>
      </Kb.Box2>
    )

  React.useEffect(() => {
    navigation.setOptions({title: pickerState === 'picker' ? 'Forward to team or chat' : 'Add a caption'})
  }, [navigation, pickerState])

  return content
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      boxGrow: {
        flexGrow: 1,
        margin: Kb.Styles.globalMargins.small,
      },
      buttonContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-end',
          borderStyle: 'solid',
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          flexShrink: 0,
          padding: Kb.Styles.globalMargins.small,
          width: '100%',
        },
        isMobile: {width: '100%'},
      }),
      container: Kb.Styles.platformStyles({
        isElectron: {height: 450},
        isMobile: {padding: Kb.Styles.globalMargins.small},
      }),
      image: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      input: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.blue,
          marginBottom: Kb.Styles.globalMargins.tiny,
          minHeight: 40,
          width: '100%',
        },
        isElectron: {maxHeight: 100},
        isTablet: {
          alignSelf: 'center',
          maxWidth: 460,
        },
      }),
      inputContainer: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      results: Kb.Styles.platformStyles({
        common: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {paddingBottom: Kb.Styles.globalMargins.tiny},
      }),
      searchFilter: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
    }) as const
)

const TeamPicker = (props: Props) => {
  return <TeamPickerInner {...props} />
}

export default TeamPicker
