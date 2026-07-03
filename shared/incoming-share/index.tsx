import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {MobileSendToChat} from '../chat/send-to-chat'
import {settingsFeedbackTab} from '@/constants/settings'
import * as FS from '@/constants/fs'
import {useConfigState} from '@/stores/config'
import {ensureError} from '@/util/errors'
import {getInboxConversationMeta} from '@/chat/inbox/metadata'
import {IncomingShareHeaderTitle} from './routes'

export const getIncomingShareSizes = (incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>) => {
  const originalTotalSize = incomingShareItems.reduce((bytes, item) => bytes + (item.originalSize ?? 0), 0)
  const scaledTotalSize = incomingShareItems.reduce(
    (bytes, item) => bytes + (item.scaledSize ?? item.originalSize ?? 0),
    0
  )
  return {originalOnly: originalTotalSize <= scaledTotalSize, originalTotalSize, scaledTotalSize}
}

export const OriginalOrCompressedButton = ({incomingShareItems}: IncomingShareProps) => {
  const {originalOnly, originalTotalSize, scaledTotalSize} = getIncomingShareSizes(incomingShareItems)
  const setUseOriginalInStore = useConfigState(s => s.dispatch.setIncomingShareUseOriginal)

  const setUseOriginalInService = (useOriginal: boolean) => {
    C.ignorePromise(
      T.RPCGen.incomingShareSetPreferenceRpcPromise({
        preference: useOriginal
          ? {compressPreference: T.RPCGen.IncomingShareCompressPreference.original}
          : {compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed},
      }).catch(() => {})
    )
  }

  const getRPC = C.useRPC(T.RPCGen.incomingShareGetPreferenceRpcPromise)
  React.useEffect(() => {
    if (!originalOnly) {
      getRPC(
        [undefined],
        pref =>
          setUseOriginalInStore(
            pref.compressPreference === T.RPCGen.IncomingShareCompressPreference.original
          ),
        err => {
          throw ensureError(err)
        }
      )
    }
  }, [originalOnly, getRPC, setUseOriginalInStore])

  const useOriginalValue = useConfigState(s => s.incomingShareUseOriginal)

  const isLarge = (useOriginalValue ? originalTotalSize : scaledTotalSize) > 1024 * 1024 * 150

  const makePopup = (p: Kb.Popup2Parms) => {
    const {hidePopup} = p
    const setUseOriginalFromUI = (useOriginal: boolean) => {
      if (!originalOnly) {
        setUseOriginalInStore(useOriginal)
      }
      setUseOriginalInService(useOriginal)
    }

    return (
      <Kb.FloatingMenu
        closeOnSelect={true}
        visible={true}
        onHidden={hidePopup}
        items={[
          {
            icon: useOriginalValue ? 'iconfont-check' : undefined,
            onClick: () => setUseOriginalFromUI(true),
            rightTitle: isLarge ? 'Large file' : undefined,
            title: `Keep full size (${FS.humanizeBytes(originalTotalSize, 1)})`,
          },
          {
            icon: useOriginalValue ? undefined : 'iconfont-check',
            onClick: () => setUseOriginalFromUI(false),
            title: `Compress (${FS.humanizeBytes(scaledTotalSize, 1)})`,
          },
        ]}
      />
    )
  }
  const {popup, showPopup} = Kb.usePopup2(makePopup)

  if (originalOnly) {
    return null
  }

  if (useOriginalValue === undefined) {
    return <Kb.ProgressIndicator />
  }

  return (
    <>
      <Kb.Icon
        type="iconfont-gear"
        padding="tiny"
        onClick={showPopup}
        color={isLarge ? Kb.Styles.globalColors.yellow : undefined}
      />
      {popup}
    </>
  )
}

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
      <Kb.Icon type="iconfont-file" color={Kb.Styles.globalColors.blue} style={styles.footerIcon} />
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
  const useOriginalValue = useConfigState(s => s.incomingShareUseOriginal)
  const {sendPaths, text} = props.incomingShareItems.reduce(
    ({sendPaths, text}, item) => {
      if (item.content) {
        return {sendPaths, text: item.content}
      }
      if (!useOriginalValue && item.scaledPath) {
        return {sendPaths: [...sendPaths, item.scaledPath], text}
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
      C.Router2.navigateToThread(selectedConversationIDKey, 'extension', undefined, undefined, undefined, text)
    }
  }, [canDirectNav, selectedConversationIDKey, sendPaths, text, navigateAppend])

  const footer = useFooter(props.incomingShareItems)
  const contentDescription = getContentDescriptionText(props.incomingShareItems)

  // When there's no compress choice the header button renders nothing, but a set
  // headerRight still gets an empty liquid glass circle on iOS 26 — so don't set
  // it at all. The button's originalOnly store sync must then happen here.
  const {originalOnly} = getIncomingShareSizes(props.incomingShareItems)
  const setUseOriginalInStore = useConfigState(s => s.dispatch.setIncomingShareUseOriginal)
  React.useEffect(() => {
    if (originalOnly) {
      setUseOriginalInStore(true)
    }
  }, [originalOnly, setUseOriginalInStore])

  React.useEffect(() => {
    navigation.setOptions({
      headerRight:
        props.incomingShareItems.length && !originalOnly
          ? () => <OriginalOrCompressedButton incomingShareItems={props.incomingShareItems} />
          : undefined,
      headerTitle: () => <IncomingShareHeaderTitle title={contentDescription} />,
    })
    return () => {
      navigation.setOptions({
        headerRight: undefined,
        headerTitle: () => <IncomingShareHeaderTitle />,
      })
    }
  }, [contentDescription, navigation, originalOnly, props.incomingShareItems])

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

const useIncomingShareItems = () => {
  const [incomingShareItems, setIncomingShareItems] = React.useState<
    ReadonlyArray<T.RPCGen.IncomingShareItem>
  >([])
  const [incomingShareError, setIncomingShareError] = React.useState<unknown>(undefined)

  const rpc = C.useRPC(T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise)
  React.useEffect(() => {
    if (!isIOS) {
      return
    }

    rpc(
      [undefined],
      items => setIncomingShareItems(items || []),
      err => setIncomingShareError(err)
    )
  }, [rpc, setIncomingShareError, setIncomingShareItems])

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

const LoadingSpinner = () => (
  <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
    <Kb.ProgressIndicator type="Large" />
  </Kb.Box2>
)

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

const styles = Kb.Styles.styleSheetCreate(() => ({
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
