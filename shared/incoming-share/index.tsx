import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as FsTypes from '../constants/types/fs'
import * as FsConstants from '../constants/fs'
import * as FsCommon from '../fs/common'
import * as FsGen from '../actions/fs-gen'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
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

  const dispatch = Container.useDispatch()
  const setUseOriginalInStore = React.useCallback(
    (useOriginal: boolean) => dispatch(ConfigGen.createSetIncomingShareUseOriginal({useOriginal})),
    [dispatch]
  )
  const setUseOriginalInService = React.useCallback((useOriginal: boolean) => {
    RPCTypes.incomingShareSetPreferenceRpcPromise({
      preference: useOriginal
        ? {compressPreference: RPCTypes.IncomingShareCompressPreference.original}
        : {compressPreference: RPCTypes.IncomingShareCompressPreference.compressed},
    })
      .then(() => {})
      .catch(() => {})
  }, [])

  // If it's original only, set original in store.
  React.useEffect(() => {
    originalOnly && setUseOriginalInStore(true)
  }, [originalOnly, setUseOriginalInStore])

  // From service to store, but only if this is not original only.
  const getRPC = useRPC(RPCTypes.incomingShareGetPreferenceRpcPromise)
  const syncCompressPreferenceFromServiceToStore = React.useCallback(() => {
    getRPC(
      [undefined],
      pref =>
        setUseOriginalInStore(pref.compressPreference === RPCTypes.IncomingShareCompressPreference.original),
      err => {
        throw err
      }
    )
  }, [getRPC, setUseOriginalInStore])
  React.useEffect(() => {
    !originalOnly && syncCompressPreferenceFromServiceToStore()
  }, [originalOnly, syncCompressPreferenceFromServiceToStore])

  const setUseOriginalFromUI = (useOriginal: boolean) => {
    !originalOnly && setUseOriginalInStore(useOriginal)
    setUseOriginalInService(useOriginal)
  }

  const useOriginalValue = Container.useSelector(state => state.config.incomingShareUseOriginal)
  const {popup, showingPopup, toggleShowingPopup} = Kb.usePopup(() => (
    <Kb.FloatingMenu
      closeOnSelect={true}
      visible={showingPopup}
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
  ))

  if (originalOnly) {
    return null
  }

  if (useOriginalValue === undefined) {
    return <Kb.ProgressIndicator />
  }

  return (
    <>
      <Kb.Icon type="iconfont-gear" padding="tiny" onClick={toggleShowingPopup} />
      {showingPopup && popup}
    </>
  )
}

const getContentDescription = (items: Array<RPCTypes.IncomingShareItem>) => {
  if (items.length === 0) {
    return undefined
  }
  if (items.length > 1) {
    return items.some(({type}) => type !== items[0].type) ? (
      <Kb.Text type="BodyTiny">{items.length} items</Kb.Text>
    ) : (
      <Kb.Text type="BodyTiny">
        {items.length} {incomingShareTypeToString(items[0].type, false, true)}
      </Kb.Text>
    )
  }

  if (items[0].content) {
    // If it's a text snippet, just say "1 text snippet" and don't show text
    // file name. We can get a file name here if the payload is from a text
    // selection (rather than URL).
    return <Kb.Text type="BodyTiny">1 {incomingShareTypeToString(items[0].type, false, false)}</Kb.Text>
  }

  // If it's a URL, originalPath is not populated.
  const name = items[0].originalPath && FsTypes.getLocalPathName(items[0].originalPath)
  return name ? (
    <FsCommon.Filename type="BodyTiny" filename={name} />
  ) : (
    <Kb.Text type="BodyTiny">1 {incomingShareTypeToString(items[0].type, false, false)}</Kb.Text>
  )
}

const useHeader = (incomingShareItems: Array<RPCTypes.IncomingShareItem>) => {
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createClearModals())
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

const useFooter = (incomingShareItems: Array<RPCTypes.IncomingShareItem>) => {
  const dispatch = Container.useDispatch()
  const saveInFiles = () => {
    dispatch(FsGen.createSetIncomingShareSource({source: incomingShareItems}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              // headerRightButton: <OriginalOrCompressedButton incomingShareItems={incomingShareItems} />,
              index: 0,
            },
            selected: 'destinationPicker',
          },
        ],
      })
    )
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
  incomingShareItems: Array<RPCTypes.IncomingShareItem>
}

const IncomingShare = (props: IncomingShareProps) => {
  const useOriginalValue = Container.useSelector(state => state.config.incomingShareUseOriginal)
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
  const dispatch = Container.useDispatch()
  const erroredSendFeedback = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {feedback: `iOS share failure`},
            selected: SettingsConstants.feedbackTab,
          },
        ],
      })
    )
  }
  const onCancel = () => dispatch(RouteTreeGen.createClearModals())

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
  const [incomingShareItems, setIncomingShareItems] = React.useState<Array<RPCTypes.IncomingShareItem>>([])
  const [incomingShareError, setIncomingShareError] = React.useState<any>(undefined)

  // iOS
  const rpc = useRPC(RPCTypes.incomingShareGetIncomingShareItemsRpcPromise)
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
  const androidShare = Container.useSelector(state => state.config.androidShare)
  const getIncomingShareItemsAndroid = React.useCallback(() => {
    if (!Platform.isAndroid || !androidShare) {
      return
    }

    const item =
      androidShare.type === RPCTypes.IncomingShareType.file
        ? {
            originalPath: androidShare.url,
            type: RPCTypes.IncomingShareType.file,
          }
        : {
            content: androidShare.text,
            type: RPCTypes.IncomingShareType.text,
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
  type: RPCTypes.IncomingShareType,
  capitalize: boolean,
  plural: boolean
): string => {
  switch (type) {
    case RPCTypes.IncomingShareType.file:
      return (capitalize ? 'File' : 'file') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.text:
      return (capitalize ? 'Text snippet' : 'text snippet') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.image:
      return (capitalize ? 'Image' : 'image') + (plural ? 's' : '')
    case RPCTypes.IncomingShareType.video:
      return (capitalize ? 'Video' : 'video') + (plural ? 's' : '')
  }
}

const isChatOnly = (items?: Array<RPCTypes.IncomingShareItem>): boolean =>
  items?.length === 1 &&
  items[0].type === RPCTypes.IncomingShareType.text &&
  !!items[0].content &&
  !items[0].originalPath

export default IncomingShareMain
