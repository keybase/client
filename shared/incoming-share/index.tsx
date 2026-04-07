import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {MobileSendToChat} from '../chat/send-to-chat'
import {settingsFeedbackTab} from '@/constants/settings'
import * as FS from '@/stores/fs'
import {useConfigState} from '@/stores/config'
import {useModalHeaderState} from '@/stores/modal-header'

export const OriginalOrCompressedButton = ({incomingShareItems}: IncomingShareProps) => {
  const originalTotalSize = incomingShareItems.reduce((bytes, item) => bytes + (item.originalSize ?? 0), 0)
  const scaledTotalSize = incomingShareItems.reduce(
    (bytes, item) => bytes + (item.scaledSize ?? item.originalSize ?? 0),
    0
  )
  const originalOnly = originalTotalSize <= scaledTotalSize
  const setUseOriginalInStore = useConfigState(s => s.dispatch.setIncomingShareUseOriginal)

  const setUseOriginalInService = (useOriginal: boolean) => {
    T.RPCGen.incomingShareSetPreferenceRpcPromise({
      preference: useOriginal
        ? {compressPreference: T.RPCGen.IncomingShareCompressPreference.original}
        : {compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed},
    })
      .then(() => {})
      .catch(() => {})
  }

  // If it's original only, set original in store.
  React.useEffect(() => {
    originalOnly && setUseOriginalInStore(true)
  }, [originalOnly, setUseOriginalInStore])

  // From service to store, but only if this is not original only.
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
          throw err
        }
      )
    }
  }, [originalOnly, getRPC, setUseOriginalInStore])

  const useOriginalValue = useConfigState(s => s.incomingShareUseOriginal)

  const isLarge = (useOriginalValue ? originalTotalSize : scaledTotalSize) > 1024 * 1024 * 150

  const makePopup = (p: Kb.Popup2Parms) => {
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
      : `${items.length} ${incomingShareTypeToString(items[0]!.type, false, true)}`
  }

  const item = items[0]
  if (!item) return ''

  if (item.content) {
    return item.content
  }

  const name = item.originalPath && T.FS.getLocalPathName(item.originalPath)
  return name || `1 ${incomingShareTypeToString(item.type, false, false)}`
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
  const navigateAppend = C.Router2.navigateAppend
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
    const {dispatch} = Chat.getConvoState(selectedConversationIDKey)
    text && dispatch.injectIntoInput(text)
    dispatch.navigateToThread('extension')
    if (sendPaths.length > 0) {
      const meta = Chat.getConvoState(selectedConversationIDKey).meta
      const tlfName = meta.conversationIDKey === selectedConversationIDKey ? meta.tlfname : ''
      navigateAppend({
        name: 'chatAttachmentGetTitles',
        params: {
          conversationIDKey: selectedConversationIDKey,
          pathAndOutboxIDs: sendPaths.map(p => ({
            path: Kb.Styles.normalizePath(p),
          })),
          selectConversationWithReason: 'extension' as const,
          tlfName,
        },
      })
    }
  }, [canDirectNav, selectedConversationIDKey, sendPaths, text, navigateAppend])

  const clearModals = C.Router2.clearModals
  const footer = useFooter(props.incomingShareItems)

  React.useEffect(() => {
    useModalHeaderState.setState({
      data: props.incomingShareItems,
      onAction: clearModals,
      title: getContentDescriptionText(props.incomingShareItems),
    })
    return () => {
      useModalHeaderState.setState({data: undefined, onAction: undefined, title: ''})
    }
  }, [props.incomingShareItems, clearModals])

  if (canDirectNav) {
    return (
      <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
        <Kb.ProgressIndicator type="Large" />
      </Kb.Box2>
    )
  }

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.globalStyles.flexOne}>
          <MobileSendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />
        </Kb.Box2>
      </Kb.Box2>
      {footer ? <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>{footer.content}</Kb.Box2> : null}
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

  // iOS
  const rpc = C.useRPC(T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise)
  React.useEffect(() => {
    if (!C.isIOS) {
      return
    }

    rpc(
      [undefined],
      items => setIncomingShareItems(items || []),
      err => setIncomingShareError(err)
    )
  }, [rpc, setIncomingShareError, setIncomingShareItems])

  // Android
  const androidShare = useConfigState(s => s.androidShare)
  React.useEffect(() => {
    if (!C.isAndroid || !androidShare) {
      return
    }

    const items =
      androidShare.type === T.RPCGen.IncomingShareType.file
        ? androidShare.urls.map(u => ({originalPath: u, type: T.RPCGen.IncomingShareType.file}))
        : [{content: androidShare.text, type: T.RPCGen.IncomingShareType.text}]
    setIncomingShareItems(items)
  }, [androidShare, setIncomingShareItems])

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
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
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
