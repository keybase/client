import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {MobileSendToChat} from '../chat/send-to-chat'
import {setInputIntent} from '@/chat/conversation/input-intent-store'
import {settingsFeedbackTab} from '@/constants/settings'
import {useConfigState} from '@/stores/config'
import {useRPCLoad} from '@/util/use-rpc-load'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {IncomingShareHeaderTitle} from './routes'

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
}

type SelectedConversationProps = {
  selectedConversationIDKey?: T.Chat.ConversationIDKey
}

const IncomingShare = (props: IncomingShareProps & SelectedConversationProps) => {
  const navigateAppend = C.Router2.navigateAppend
  const navigation = useNavigation()
  // Always the untouched original: trimming and compression happen downstream on
  // the get-titles screen, so the extension's copy must not be pre-processed.
  const {sendPaths, text} = props.incomingShareItems.reduce(
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

  // Pre-selected conv: navToThread + attachments directly (skip MobileSendToChat)
  const selectedConversationIDKey = props.selectedConversationIDKey
  const canDirectNav = selectedConversationIDKey && T.Chat.isValidConversationIDKey(selectedConversationIDKey)
  const hasNavigatedRef = React.useRef(false)
  React.useEffect(() => {
    if (!canDirectNav || hasNavigatedRef.current) return
    hasNavigatedRef.current = true
    if (sendPaths.length > 0) {
      C.Router2.navigateToThread(selectedConversationIDKey, 'extension')
      const meta = getInboxConversationMeta(selectedConversationIDKey)
      const tlfName = meta?.conversationIDKey === selectedConversationIDKey ? meta.tlfname : ''
      navigateAppend({
        name: 'chatAttachmentGetTitles',
        params: {
          conversationIDKey: selectedConversationIDKey,
          inputPrefillText: text,
          pathAndOutboxIDs: sendPaths.map(p => ({
            path: Kb.Styles.normalizePath(p),
          })),
          selectConversationWithReason: 'extension' as const,
          tlfName,
        },
      })
    } else {
      if (text !== undefined) {
        setInputIntent(selectedConversationIDKey, {text, type: 'injectText'})
      }
      C.Router2.navigateToThread(selectedConversationIDKey, 'extension')
    }
  }, [canDirectNav, selectedConversationIDKey, sendPaths, text, navigateAppend])

  const footer = useFooter(props.incomingShareItems)
  const contentDescription = getContentDescriptionText(props.incomingShareItems)

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
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1}>
        <MobileSendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />
      </Kb.Box2>
      {footer ? <Kb.ModalFooter>{footer}</Kb.ModalFooter> : null}
    </>
  )
}

const IncomingShareError = () => {
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
      <Kb.Text type="BodySmall">Whoops! Something went wrong.</Kb.Text>
      <Kb.Button label="Please let us know" onClick={erroredSendFeedback} />
    </Kb.Box2>
  )
}

const noShareItems = new Array<T.RPCGen.IncomingShareItem>()

const useIncomingShareItems = () => {
  const {data: incomingShareItems = noShareItems, error: incomingShareError} = useRPCLoad(
    T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise,
    [undefined],
    {enabled: isIOS, map: items => items || noShareItems}
  )

  const androidShare = useConfigState(s => s.androidShare)
  const androidShareItems =
    isAndroid && androidShare
      ? androidShare.type === T.RPCGen.IncomingShareType.file
        ? androidShare.urls.map(u => ({originalPath: u, type: T.RPCGen.IncomingShareType.file}))
        : [{content: androidShare.text, type: T.RPCGen.IncomingShareType.text}]
      : undefined

  // The share is consumed by this screen; clear it so a later cold-path
  // getInitialURL doesn't resurface a stale share (see router-v2/linking.tsx).
  const setAndroidShare = useConfigState(s => s.dispatch.setAndroidShare)
  React.useEffect(() => {
    return () => {
      if (isAndroid) {
        setAndroidShare(undefined)
      }
    }
  }, [setAndroidShare])

  return {incomingShareError, incomingShareItems: androidShareItems ?? incomingShareItems}
}

const LoadingSpinner = () => <Kb.LoadingScreen type="Large" />

const IncomingShareMain = (props: SelectedConversationProps) => {
  const {incomingShareError, incomingShareItems} = useIncomingShareItems()
  return incomingShareError ? (
    <IncomingShareError />
  ) : incomingShareItems.length ? (
    <IncomingShare
      incomingShareItems={incomingShareItems}
      selectedConversationIDKey={props.selectedConversationIDKey}
    />
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
