import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {SendToChat} from '../chat/send-to-chat'
import {settingsFeedbackTab} from '@/constants/settings'
import {useRPCLoad} from '@/util/use-rpc-load'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {IncomingShareHeaderTitle} from './routes'
import {readAndroidShare} from '@/constants/init/android-share'
import {sharedTextForBatch} from '@/util/shared-text-file'

export const getContentDescriptionText = (items: ReadonlyArray<T.RPCGen.IncomingShareItem>): string => {
  if (items.length === 0) {
    return ''
  }
  if (items.length > 1) {
    return items.some(({type}) => type !== items[0]?.type)
      ? `${items.length} items`
      : `${items.length} ${incomingShareTypeToString(items[0]!.type, true)}`
  }

  const item = items[0]
  if (!item) return ''

  if (item.content) {
    return item.content
  }

  const name = item.originalPath && T.FS.getLocalPathName(item.originalPath)
  return name || `1 ${incomingShareTypeToString(item.type, false)}`
}

// What to tell the user about items the share extension couldn't hand over.
export const getDroppedItemsMessage = (sharedCount: number, droppedCount: number): string => {
  if (droppedCount <= 0) {
    return ''
  }
  if (sharedCount <= 0) {
    return droppedCount === 1
      ? "The shared item couldn't be prepared. Please try sharing it again."
      : `None of the ${droppedCount} shared items could be prepared. Please try sharing them again.`
  }
  // No total: the extension merges a share's links and text into one item, so
  // the items here don't add up to what the user picked.
  return droppedCount === 1 ? "1 item couldn't be prepared." : `${droppedCount} items couldn't be prepared.`
}

const useFooter = (incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const navigateAppend = C.Router2.navigateAppend
  const saveInFiles = () => {
    navigateAppend({
      name: 'destinationPicker',
      params: {
        parentPath: T.FS.stringToPath('/keybase'),
        source: {source: incomingShareItems, type: T.FS.DestinationPickerSource.IncomingShare},
      },
    })
  }
  return isChatOnly(incomingShareItems) ? undefined : (
    <Kb.ClickableBox direction="horizontal" centerChildren={true} fullWidth={true} onClick={saveInFiles}>
      <Kb.Icon type="iconfont-file" color={theme.blue} style={styles.footerIcon} />
      <Kb.Text type="BodyBigLink">Save in Files</Kb.Text>
    </Kb.ClickableBox>
  )
}

type IncomingShareProps = {
  incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>
  droppedMessage: string
  // The service's id for the share; empty on Android.
  shareID: string
}

type SelectedConversationProps = {
  selectedConversationIDKey?: T.Chat.ConversationIDKey
}

type IncomingShareMainProps = SelectedConversationProps & {
  androidShareID?: number
}

const IncomingShare = (props: IncomingShareProps & SelectedConversationProps) => {
  const {droppedMessage, incomingShareItems, selectedConversationIDKey, shareID} = props
  const navigateAppend = C.Router2.navigateAppend
  const navigation = useNavigation()
  // Always the untouched original: trimming and compression happen downstream on
  // the get-titles screen, so the extension's copy must not be pre-processed.
  const {sendPaths, text} = incomingShareItems.reduce(
    ({sendPaths, text}, item) => {
      if (item.content) {
        return {sendPaths, text: item.content}
      }
      if (item.originalPath) {
        return {sendPaths: [...sendPaths, item.originalPath], text}
      }
      return {sendPaths, text}
    },
    {sendPaths: new Array<string>(), text: undefined as string | undefined}
  )

  // Pre-selected conv: navToThread + attachments directly (skip SendToChat)
  const canDirectNav = selectedConversationIDKey && T.Chat.isValidConversationIDKey(selectedConversationIDKey)
  const hasNavigatedRef = React.useRef(false)
  React.useEffect(() => {
    if (!canDirectNav || hasNavigatedRef.current) return
    hasNavigatedRef.current = true
    if (shareID) {
      markShareRouted(shareID)
    }
    if (sendPaths.length > 0) {
      C.Router2.navigateToThread(selectedConversationIDKey, 'extension')
      const meta = getInboxConversationMeta(selectedConversationIDKey)
      const ours = meta?.conversationIDKey === selectedConversationIDKey ? meta : undefined
      const f = async () => {
        const shared = await sharedTextForBatch(ours?.draft ?? '', text)
        navigateAppend({
          name: 'chatAttachmentGetTitles',
          params: {
            conversationIDKey: selectedConversationIDKey,
            inputPrefillText: shared.text,
            notice: droppedMessage || undefined,
            pathAndOutboxIDs: [...sendPaths, ...(shared.path ? [shared.path] : [])].map(p => ({
              path: Kb.Styles.normalizePath(p),
            })),
            selectConversationWithReason: 'extension' as const,
            tlfName: ours?.tlfname || undefined,
          },
        })
      }
      C.ignorePromise(f())
    } else {
      C.Router2.navigateToThread(selectedConversationIDKey, 'extension', {
        intent:
          text === undefined
            ? undefined
            : {append: true, notice: droppedMessage || undefined, text, type: 'injectText'},
      })
    }
  }, [canDirectNav, selectedConversationIDKey, sendPaths, text, navigateAppend, droppedMessage, shareID])

  const footer = useFooter(incomingShareItems)
  const contentDescription = getContentDescriptionText(incomingShareItems)

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <IncomingShareHeaderTitle title={contentDescription} />,
    })
    return () => {
      navigation.setOptions({
        headerTitle: () => <IncomingShareHeaderTitle />,
      })
    }
  }, [contentDescription, navigation])

  if (canDirectNav) {
    return <LoadingSpinner />
  }

  return (
    <Kb.ModalScreen
      scroll={false}
      padding="none"
      footer={footer}
      banner={droppedMessage ? <Kb.Banner color="yellow">{droppedMessage}</Kb.Banner> : undefined}
    >
      <SendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />
    </Kb.ModalScreen>
  )
}

const IncomingShareError = (props: {message?: string}) => {
  const {message} = props
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const erroredSendFeedback = () => {
    clearModals()
    navigateAppend({
      name: settingsFeedbackTab,
      params: {feedback: `iOS share failure`},
    })
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" centerChildren={true}>
      <Kb.Text type="BodySmall" center={true}>
        {message || 'Whoops! Something went wrong.'}
      </Kb.Text>
      <Kb.Button label="Please let us know" onClick={erroredSendFeedback} />
    </Kb.Box2>
  )
}

const NothingToShare = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
    <Kb.Text type="BodySmall" center={true}>
      {"There's nothing to share."}
    </Kb.Text>
  </Kb.Box2>
)

const noShareItems = new Array<T.RPCGen.IncomingShareItem>()
const noIncomingShare = {droppedCount: 0, id: '', items: noShareItems}
type Share = {droppedCount: number; id: string; items: ReadonlyArray<T.RPCGen.IncomingShareItem>}

const isEmptyShare = (share: Share) => share.items.length === 0 && share.droppedCount === 0

// What a load shows, given the share already shown. The service hands a share out again for a
// while, in case an answer was lost, and nothing after that: neither replaces the share shown. A
// newer share does.
export const nextShare = (prev: Share | undefined, next: Share): Share =>
  prev && !isEmptyShare(prev) && (isEmptyShare(next) || next.id === prev.id) ? prev : next

// The share last sent straight to its conversation. The service only ever hands out its last share
// again, so if that comes back (the link opened a second time) it is not sent there again: its
// text would be added to the draft twice.
let lastRoutedShareID = ''
const markShareRouted = (id: string) => {
  lastRoutedShareID = id
}
const wasShareRouted = (id: string) => id !== '' && id === lastRoutedShareID

// androidShareID: the Android share this screen is for, from its link.
const useIncomingShareItems = (androidShareID?: number) => {
  const [incomingShare, setIncomingShare] = React.useState<Share>()
  const {error: incomingShareError} = useRPCLoad(
    T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise,
    [undefined],
    {
      enabled: isIOS,
      map: res => ({droppedCount: res.droppedCount, id: res.id, items: res.items || noShareItems}),
      onResult: next =>
        setIncomingShare(prev => nextShare(prev, wasShareRouted(next.id) ? noIncomingShare : next)),
    }
  )

  // An Android screen shows only the share its link names, read from native. When it is done with
  // is up to constants/init/android-share, from the navigation state.
  const androidShare = React.useMemo(
    () => (isAndroid && androidShareID !== undefined ? readAndroidShare(androidShareID) : undefined),
    [androidShareID]
  )

  if (isAndroid) {
    return {
      droppedCount: androidShare?.droppedCount ?? 0,
      incomingShareError: undefined,
      incomingShareItems: androidShare?.items ?? noShareItems,
      // A link with no share behind it: done with, or opened by hand without an id.
      nothingToShare: true,
      shareID: '',
    }
  }
  const {droppedCount, id, items} = incomingShare ?? noIncomingShare
  return {
    droppedCount,
    incomingShareError: items.length || droppedCount ? undefined : incomingShareError,
    incomingShareItems: items,
    shareID: id,
    // A link opened again, or from somewhere other than a share, has no share behind it.
    nothingToShare: incomingShare !== undefined,
  }
}

const LoadingSpinner = () => <Kb.LoadingScreen type="Large" />

const IncomingShareMain = (props: IncomingShareMainProps) => {
  const {androidShareID, selectedConversationIDKey} = props
  const {droppedCount, incomingShareError, incomingShareItems, nothingToShare, shareID} =
    useIncomingShareItems(androidShareID)
  const droppedMessage = getDroppedItemsMessage(incomingShareItems.length, droppedCount)
  return incomingShareError ? (
    <IncomingShareError />
  ) : incomingShareItems.length ? (
    <IncomingShare
      droppedMessage={droppedMessage}
      incomingShareItems={incomingShareItems}
      selectedConversationIDKey={selectedConversationIDKey}
      shareID={shareID}
    />
  ) : droppedMessage ? (
    <IncomingShareError message={droppedMessage} />
  ) : nothingToShare ? (
    <NothingToShare />
  ) : (
    <LoadingSpinner />
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  footerIcon: {
    marginRight: Kb.Styles.globalMargins.tiny,
  },
}))

const incomingShareTypeToString = (type: T.RPCGen.IncomingShareType, plural: boolean): string => {
  switch (type) {
    case T.RPCGen.IncomingShareType.file:
      return 'file' + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.text:
      return 'text snippet' + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.image:
      return 'image' + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.video:
      return 'video' + (plural ? 's' : '')
  }
}

const isChatOnly = (items: ReadonlyArray<T.RPCGen.IncomingShareItem>): boolean =>
  items.length === 1 &&
  items[0]!.type === T.RPCGen.IncomingShareType.text &&
  !!items[0]!.content &&
  !items[0]!.originalPath

export default IncomingShareMain
