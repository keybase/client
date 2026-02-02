import * as C from '@/constants'
import * as Chat from '@/constants/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as FsCommon from '@/fs/common'
import {MobileSendToChat} from '../chat/send-to-chat'
import {navigateAppend} from '@/constants/router2/util'
import {settingsFeedbackTab} from '@/constants/settings'
import * as FS from '@/constants/fs'
import {useFSState} from '@/constants/fs'
import {useConfigState} from '@/constants/config'

export const OriginalOrCompressedButton = ({incomingShareItems}: IncomingShareProps) => {
  const originalTotalSize = incomingShareItems.reduce((bytes, item) => bytes + (item.originalSize ?? 0), 0)
  const scaledTotalSize = incomingShareItems.reduce(
    (bytes, item) => bytes + (item.scaledSize ?? item.originalSize ?? 0),
    0
  )
  const originalOnly = originalTotalSize <= scaledTotalSize
  const setUseOriginalInStore = useConfigState(s => s.dispatch.setIncomingShareUseOriginal)

  const setUseOriginalInService = React.useCallback((useOriginal: boolean) => {
    T.RPCGen.incomingShareSetPreferenceRpcPromise({
      preference: useOriginal
        ? {compressPreference: T.RPCGen.IncomingShareCompressPreference.original}
        : {compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed},
    })
      .then(() => {})
      .catch(() => {})
  }, [])

  // If it's original only, set original in store.
  React.useEffect(() => {
    originalOnly && setUseOriginalInStore(true)
  }, [originalOnly, setUseOriginalInStore])

  // From service to store, but only if this is not original only.
  const getRPC = C.useRPC(T.RPCGen.incomingShareGetPreferenceRpcPromise)
  const syncCompressPreferenceFromServiceToStore = React.useCallback(() => {
    getRPC(
      [undefined],
      pref =>
        setUseOriginalInStore(pref.compressPreference === T.RPCGen.IncomingShareCompressPreference.original),
      err => {
        throw err
      }
    )
  }, [getRPC, setUseOriginalInStore])
  React.useEffect(() => {
    !originalOnly && syncCompressPreferenceFromServiceToStore()
  }, [originalOnly, syncCompressPreferenceFromServiceToStore])

  const useOriginalValue = useConfigState(s => s.incomingShareUseOriginal)

  const isLarge = (useOriginalValue ? originalTotalSize : scaledTotalSize) > 1024 * 1024 * 150

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {hidePopup} = p
      const setUseOriginalFromUI = (useOriginal: boolean) => {
        !originalOnly && setUseOriginalInStore(useOriginal)
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
    },
    [
      isLarge,
      originalTotalSize,
      scaledTotalSize,
      useOriginalValue,
      originalOnly,
      setUseOriginalInService,
      setUseOriginalInStore,
    ]
  )
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
        colorOverride={isLarge ? Kb.Styles.globalColors.yellow : undefined}
      />
      {popup}
    </>
  )
}

const getContentDescription = (items: ReadonlyArray<T.RPCGen.IncomingShareItem>) => {
  if (items.length === 0) {
    return undefined
  }
  if (items.length > 1) {
    return items.some(({type}) => type !== items[0]?.type) ? (
      <Kb.Text type="BodyTiny">{items.length} items</Kb.Text>
    ) : (
      <Kb.Text type="BodyTiny">
        {items.length} {incomingShareTypeToString(items[0]!.type, false, true)}
      </Kb.Text>
    )
  }

  const item = items[0]
  if (!item) return undefined

  if (item.content) {
    return (
      <Kb.Text type="BodyTiny" lineClamp={1}>
        {item.content}
      </Kb.Text>
    )
  }

  // If it's a URL, originalPath is not populated.
  const name = item.originalPath && T.FS.getLocalPathName(item.originalPath)
  return name ? (
    <FsCommon.Filename type="BodyTiny" filename={name} />
  ) : (
    <Kb.Text type="BodyTiny">1 {incomingShareTypeToString(item.type, false, false)}</Kb.Text>
  )
}

const useHeader = (incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>) => {
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => clearModals()
  return {
    leftButton: (
      <Kb.Text type="BodyBigLink" onClick={onCancel}>
        Cancel
      </Kb.Text>
    ),
    rightButton: <OriginalOrCompressedButton incomingShareItems={incomingShareItems} />,
    title: (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        {getContentDescription(incomingShareItems)}
        <Kb.Text type="BodyBig">Share to...</Kb.Text>
      </Kb.Box2>
    ),
  }
}

const useFooter = (incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>) => {
  const setIncomingShareSource = useFSState(s => s.dispatch.setIncomingShareSource)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const saveInFiles = () => {
    setIncomingShareSource(incomingShareItems)
    navigateAppend({
      props: {
        // headerRightButton: <OriginalOrCompressedButton incomingShareItems={incomingShareItems} />,
        index: 0,
      },
      selected: 'destinationPicker',
    })
  }
  return isChatOnly(incomingShareItems)
    ? undefined
    : {
        content: (
          <Kb.ClickableBox style={styles.footer} onClick={saveInFiles}>
            <Kb.Icon type="iconfont-file" color={Kb.Styles.globalColors.blue} style={styles.footerIcon} />
            <Kb.Text type="BodyBigLink">Save in Files</Kb.Text>
          </Kb.ClickableBox>
        ),
      }
}

type IncomingShareProps = {
  incomingShareItems: ReadonlyArray<T.RPCGen.IncomingShareItem>
}

type IncomingShareWithSelectionProps = IncomingShareProps & {
  selectedConversationIDKey?: T.Chat.ConversationIDKey
}

const IncomingShare = (props: IncomingShareWithSelectionProps) => {
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
  const canDirectNav =
    selectedConversationIDKey && Chat.isValidConversationIDKey(selectedConversationIDKey)
  const hasNavigatedRef = React.useRef(false)
  React.useEffect(() => {
    if (!canDirectNav || hasNavigatedRef.current) return
    hasNavigatedRef.current = true
    const {dispatch} = Chat.getConvoState(selectedConversationIDKey!)
    text && dispatch.injectIntoInput(text)
    dispatch.navigateToThread('extension')
    if (sendPaths.length > 0) {
      const meta = Chat.getConvoState(selectedConversationIDKey!).meta
      const tlfName =
        meta.conversationIDKey === selectedConversationIDKey ? meta.tlfname : ''
      navigateAppend({
        props: {
          conversationIDKey: selectedConversationIDKey,
          pathAndOutboxIDs: sendPaths.map(p => ({
            path: Kb.Styles.normalizePath(p),
          })),
          selectConversationWithReason: 'extension' as const,
          tlfName,
        },
        selected: 'chatAttachmentGetTitles',
      })
    }
  }, [canDirectNav, selectedConversationIDKey, sendPaths, text])

  if (canDirectNav) {
    return (
      <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
        <Kb.ProgressIndicator type="Large" />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Modal
      noScrollView={true}
      header={useHeader(props.incomingShareItems)}
      footer={useFooter(props.incomingShareItems)}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.globalStyles.flexOne}>
          <MobileSendToChat
            isFromShareExtension={true}
            sendPaths={sendPaths}
            text={text}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const IncomingShareError = () => {
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const erroredSendFeedback = () => {
    clearModals()
    navigateAppend({
      props: {feedback: `iOS share failure`},
      selected: settingsFeedbackTab,
    })
  }
  const onCancel = () => clearModals()

  return (
    <Kb.Modal
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="small" centerChildren={true}>
        <Kb.Text type="BodySmall">Whoops! Something went wrong.</Kb.Text>
        <Kb.Button label="Please let us know" onClick={erroredSendFeedback} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const useIncomingShareItems = () => {
  const [incomingShareItems, setIncomingShareItems] = React.useState<
    ReadonlyArray<T.RPCGen.IncomingShareItem>
  >([])
  const [incomingShareError, setIncomingShareError] = React.useState<unknown>(undefined)

  // iOS
  const rpc = C.useRPC(T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise)
  const getIncomingShareItemsIOS = React.useCallback(() => {
    if (!C.isIOS) {
      return
    }

    rpc(
      [undefined],
      items => setIncomingShareItems(items || []),
      err => setIncomingShareError(err)
    )
  }, [rpc, setIncomingShareError, setIncomingShareItems])
  React.useEffect(getIncomingShareItemsIOS, [getIncomingShareItemsIOS])

  // Android
  const androidShare = useConfigState(s => s.androidShare)
  const getIncomingShareItemsAndroid = React.useCallback(() => {
    if (!C.isAndroid || !androidShare) {
      return
    }

    const items =
      androidShare.type === T.RPCGen.IncomingShareType.file
        ? androidShare.urls.map(u => ({originalPath: u, type: T.RPCGen.IncomingShareType.file}))
        : [{content: androidShare.text, type: T.RPCGen.IncomingShareType.text}]
    setIncomingShareItems(items)
  }, [androidShare, setIncomingShareItems])
  React.useEffect(getIncomingShareItemsAndroid, [getIncomingShareItemsAndroid])

  return {incomingShareError, incomingShareItems}
}

type IncomingShareMainProps = {
  selectedConversationIDKey?: T.Chat.ConversationIDKey
}

const IncomingShareMain = (props: IncomingShareMainProps) => {
  const {incomingShareError, incomingShareItems} = useIncomingShareItems()
  return incomingShareError ? (
    <IncomingShareError />
  ) : incomingShareItems.length ? (
    <IncomingShare
      incomingShareItems={incomingShareItems}
      selectedConversationIDKey={props.selectedConversationIDKey}
    />
  ) : (
    <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
      <Kb.ProgressIndicator type="Large" />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  footer: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerIcon: {
    marginRight: Kb.Styles.globalMargins.tiny,
  },
}))

const incomingShareTypeToString = (
  type: T.RPCGen.IncomingShareType,
  capitalize: boolean,
  plural: boolean
): string => {
  switch (type) {
    case T.RPCGen.IncomingShareType.file:
      return (capitalize ? 'File' : 'file') + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.text:
      return (capitalize ? 'Text snippet' : 'text snippet') + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.image:
      return (capitalize ? 'Image' : 'image') + (plural ? 's' : '')
    case T.RPCGen.IncomingShareType.video:
      return (capitalize ? 'Video' : 'video') + (plural ? 's' : '')
  }
}

const isChatOnly = (items?: ReadonlyArray<T.RPCGen.IncomingShareItem>): boolean =>
  items?.length === 1 &&
  items[0]!.type === T.RPCGen.IncomingShareType.text &&
  !!items[0]!.content &&
  !items[0]!.originalPath

export default IncomingShareMain
