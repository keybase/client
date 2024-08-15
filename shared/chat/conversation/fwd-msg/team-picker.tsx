import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import * as T from '@/constants/types'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import debounce from 'lodash/debounce'
import logger from '@/logger'

type Props = {ordinal: T.Chat.Ordinal}

type PickerState = 'picker' | 'title'

const TeamPicker = (props: Props) => {
  const srcConvID = C.useChatContext(s => s.id)
  const ordinal = props.ordinal
  const message = C.useChatContext(s => s.messageMap.get(ordinal))
  const [pickerState, setPickerState] = React.useState<PickerState>('picker')
  const [term, setTerm] = React.useState('')
  const dstConvIDRef = React.useRef<Uint8Array | undefined>()
  const [results, setResults] = React.useState<ReadonlyArray<T.RPCChat.ConvSearchHit>>([])
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const fwdMsg = C.useRPC(T.RPCChat.localForwardMessageNonblockRpcPromise)
  const submit = C.useRPC(T.RPCChat.localForwardMessageConvSearchRpcPromise)
  const [lastTerm, setLastTerm] = React.useState('init')
  if (lastTerm !== term) {
    setLastTerm(term)
    setWaiting(true)
    submit(
      [{term}],
      result => {
        setWaiting(false)
        setResults(result ?? [])
      },
      error => {
        setWaiting(false)
        setError('Something went wrong, please try again.')
        logger.info('TeamPicker: error loading search results: ' + error.message)
      }
    )
  }

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }

  const [title, setTitle] = React.useState('')

  let preview: React.ReactNode = (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Icon type="icon-file-uploading-48" />
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
        if (C.Chat.isImageViewable(message)) {
          const src = message.fileURL || message.previewURL
          preview = src ? <Kb.ZoomableImage src={src} style={styles.image} boxCacheKey="fwdheics" /> : null
        }
    }
  }

  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
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
      () => {
        setWaiting(false)
      },
      error => {
        setWaiting(false)
        setError('Something went wrong, please try again.')
        logger.info('TeamPicker: error loading search results: ' + error.message)
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

    // add caption on files, otherwise we have an effect below which will submit
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

  const content =
    pickerState === 'picker' ? (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search chats and teams...`}
            placeholderCentered={true}
            onChange={debounce(setTerm, 200)}
            style={styles.searchFilter}
            focusOnMount={true}
            waiting={waiting}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          {error.length > 0 ? (
            <Kb.Text type="Body" style={{alignSelf: 'center', color: Styles.globalColors.redDark}}>
              {error}
            </Kb.Text>
          ) : (
            <Kb.List2
              indexAsKey={true}
              items={results}
              itemHeight={{sizeType: 'Large', type: 'fixedListItem2Auto'}}
              renderItem={renderResult}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        <Kb.BoxGrow2 style={styles.boxGrow}>{preview}</Kb.BoxGrow2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
          <Kb.PlainInput
            style={styles.input}
            autoFocus={true}
            autoCorrect={true}
            placeholder="Add a caption..."
            multiline={false}
            padding="tiny"
            onEnterKeyDown={onSubmit}
            onChangeText={setTitle}
            value={title}
            selectTextOnFocus={true}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {Styles.isMobile ? null : (
            <Kb.Button fullWidth={true} type="Dim" onClick={onClose} label="Cancel" />
          )}
          <Kb.Button fullWidth={true} onClick={onSubmit} label="Send" />
        </Kb.ButtonBar>
      </Kb.Box2>
    )

  return (
    <Kb.Modal
      noScrollView={true}
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : undefined,
        title: pickerState === 'picker' ? 'Forward to team or chat' : 'Add a caption',
      }}
    >
      {content}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      boxGrow: {
        flexGrow: 1,
        margin: Styles.globalMargins.small,
      },
      buttonContainer: Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-end',
          borderStyle: 'solid',
          borderTopColor: Styles.globalColors.black_10,
          borderTopWidth: 1,
          flexShrink: 0,
          padding: Styles.globalMargins.small,
          width: '100%',
        },
        isMobile: {width: '100%'},
      }),
      container: Styles.platformStyles({
        isElectron: {height: 450},
        isMobile: {padding: Styles.globalMargins.small},
      }),
      image: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      input: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.blue,
          borderRadius: Styles.borderRadius,
          borderWidth: 1,
          marginBottom: Styles.globalMargins.tiny,
          minHeight: 40,
          padding: Styles.globalMargins.xtiny,
          width: '100%',
        },
        isElectron: {maxHeight: 100},
        isTablet: {
          alignSelf: 'center',
          maxWidth: 460,
        },
      }),
      inputContainer: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      results: Styles.platformStyles({
        common: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {paddingBottom: Styles.globalMargins.tiny},
      }),
      searchFilter: Styles.platformStyles({
        common: {
          marginBottom: Styles.globalMargins.xsmall,
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default TeamPicker
