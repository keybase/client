import * as C from '../constants'
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as T from '../constants/types'
import * as FsConstants from '../constants/fs'
import * as FsCommon from '../fs/common'
import * as Platform from '../constants/platform'
import * as SettingsConstants from '../constants/settings'
import {MobileSendToChat} from '../chat/send-to-chat'
import useRPC from '../util/use-rpc'

export const OriginalOrCompressedButton = ({incomingShareItems}: IncomingShareProps) => {
  const originalTotalSize = incomingShareItems.reduce((bytes, item) => bytes + (item.originalSize ?? 0), 0)
  const scaledTotalSize = incomingShareItems.reduce(
    (bytes, item) => bytes + (item.scaledSize ?? item.originalSize ?? 0),
    0
  )
  const originalOnly = originalTotalSize <= scaledTotalSize
  const setUseOriginalInStore = C.useConfigState.getState().dispatch.setIncomingShareUseOriginal

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
  const getRPC = useRPC(T.RPCGen.incomingShareGetPreferenceRpcPromise)
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

  const useOriginalValue = C.useConfigState(s => s.incomingShareUseOriginal)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {toggleShowingPopup} = p
      const setUseOriginalFromUI = (useOriginal: boolean) => {
        !originalOnly && setUseOriginalInStore(useOriginal)
        setUseOriginalInService(useOriginal)
      }

      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          visible={true}
          onHidden={toggleShowingPopup}
          items={[
            {
              icon: useOriginalValue ? 'iconfont-check' : undefined,
              onClick: () => setUseOriginalFromUI(true),
              title: `Keep full size (${FsConstants.humanizeBytes(originalTotalSize, 1)})`,
            },
            {
              icon: useOriginalValue ? undefined : 'iconfont-check',
              onClick: () => setUseOriginalFromUI(false),
              title: `Compress (${FsConstants.humanizeBytes(scaledTotalSize, 1)})`,
            },
          ]}
        />
      )
    },
    [
      originalTotalSize,
      scaledTotalSize,
      useOriginalValue,
      originalOnly,
      setUseOriginalInService,
      setUseOriginalInStore,
    ]
  )
  const {popup, toggleShowingPopup} = Kb.usePopup2(makePopup)

  if (originalOnly) {
    return null
  }

  if (useOriginalValue === undefined) {
    return <Kb.ProgressIndicator />
  }

  return (
    <>
      <Kb.Icon type="iconfont-gear" padding="tiny" onClick={toggleShowingPopup} />
      {popup}
    </>
  )
}

const getContentDescription = (items: Array<T.RPCGen.IncomingShareItem>) => {
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

  if (items[0]!.content) {
    // If it's a text snippet, just say "1 text snippet" and don't show text
    // file name. We can get a file name here if the payload is from a text
    // selection (rather than URL).
    return <Kb.Text type="BodyTiny">1 {incomingShareTypeToString(items[0]!.type, false, false)}</Kb.Text>
  }

  // If it's a URL, originalPath is not populated.
  const name = items[0]!.originalPath && T.FS.getLocalPathName(items[0]!.originalPath)
  return name ? (
    <FsCommon.Filename type="BodyTiny" filename={name} />
  ) : (
    <Kb.Text type="BodyTiny">1 {incomingShareTypeToString(items[0]!.type, false, false)}</Kb.Text>
  )
}

const useHeader = (incomingShareItems: Array<T.RPCGen.IncomingShareItem>) => {
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

const useFooter = (incomingShareItems: Array<T.RPCGen.IncomingShareItem>) => {
  const setIncomingShareSource = C.useFSState(s => s.dispatch.setIncomingShareSource)
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
            <Kb.Icon type="iconfont-file" color={Styles.globalColors.blue} style={styles.footerIcon} />
            <Kb.Text type="BodyBigLink">Save in Files</Kb.Text>
          </Kb.ClickableBox>
        ),
      }
}

type IncomingShareProps = {
  incomingShareItems: Array<T.RPCGen.IncomingShareItem>
}

const IncomingShare = (props: IncomingShareProps) => {
  const useOriginalValue = C.useConfigState(s => s.incomingShareUseOriginal)
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
    {sendPaths: [] as Array<string>, text: undefined as string | undefined}
  )
  return (
    <Kb.Modal
      noScrollView={true}
      header={useHeader(props.incomingShareItems)}
      footer={useFooter(props.incomingShareItems)}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexOne}>
          <MobileSendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />
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
      selected: SettingsConstants.feedbackTab,
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
  const [incomingShareItems, setIncomingShareItems] = React.useState<Array<T.RPCGen.IncomingShareItem>>([])
  const [incomingShareError, setIncomingShareError] = React.useState<any>(undefined)

  // iOS
  const rpc = useRPC(T.RPCGen.incomingShareGetIncomingShareItemsRpcPromise)
  const getIncomingShareItemsIOS = React.useCallback(() => {
    if (!Platform.isIOS) {
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
  const androidShare = C.useConfigState(s => s.androidShare)
  const getIncomingShareItemsAndroid = React.useCallback(() => {
    if (!Platform.isAndroid || !androidShare) {
      return
    }

    const item =
      androidShare.type === T.RPCGen.IncomingShareType.file
        ? {
            originalPath: androidShare.url,
            type: T.RPCGen.IncomingShareType.file,
          }
        : {
            content: androidShare.text,
            type: T.RPCGen.IncomingShareType.text,
          }
    setIncomingShareItems([item])
  }, [androidShare, setIncomingShareItems])
  React.useEffect(getIncomingShareItemsAndroid, [getIncomingShareItemsAndroid])

  return {
    incomingShareError,
    incomingShareItems,
  }
}

const IncomingShareMain = () => {
  const {incomingShareError, incomingShareItems} = useIncomingShareItems()
  return incomingShareError ? (
    <IncomingShareError />
  ) : incomingShareItems?.length ? (
    <IncomingShare incomingShareItems={incomingShareItems} />
  ) : (
    <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
      <Kb.ProgressIndicator type="Large" />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  footer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerIcon: {
    marginRight: Styles.globalMargins.tiny,
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

const isChatOnly = (items?: Array<T.RPCGen.IncomingShareItem>): boolean =>
  items?.length === 1 &&
  items[0]!.type === T.RPCGen.IncomingShareType.text &&
  !!items[0]!.content &&
  !items[0]!.originalPath

export default IncomingShareMain
