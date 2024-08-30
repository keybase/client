import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {OrdinalContext} from '../ids-context'
import {sharedStyles} from '../shared-styles'

type Props = {
  transferState: T.Chat.MessageAttachmentTransferState
  toastTargetRef?: React.RefObject<Kb.MeasureRef>
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = Kb.Styles.isMobile ? Math.min(356, Kb.Styles.dimensionWidth - 70) : 356
export const maxHeight = 320

export const missingMessage = C.Chat.makeMessageAttachment()

export const ShowToastAfterSaving = ({transferState, toastTargetRef}: Props) => {
  const [showingToast, setShowingToast] = React.useState(false)
  const lastTransferStateRef = React.useRef(transferState)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>()

  if (transferState !== lastTransferStateRef.current) {
    // was downloading and now not
    if (
      (lastTransferStateRef.current === 'mobileSaving' || lastTransferStateRef.current === 'downloading') &&
      !transferState
    ) {
      setShowingToast(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowingToast(false)
      }, 2000)
    }
    lastTransferStateRef.current = transferState
  }

  React.useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
    }
  }, [])

  const [allowToast, setAllowToast] = React.useState(true)

  // since this uses portals we need to hide if we're hidden else we can get stuck showing if our render is frozen
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setAllowToast(true)
      return () => {
        setAllowToast(false)
      }
    }, [])
  )

  return allowToast && showingToast ? (
    <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={true} toastTargetRef={toastTargetRef} />
  ) : null
}

export const TransferIcon = (p: {style: Kb.Styles.StylesCrossPlatform}) => {
  const {style} = p
  const ordinal = React.useContext(OrdinalContext)
  const state = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    if (!m || m.type !== 'attachment') {
      return 'none'
    }

    if (m.downloadPath?.length) {
      return 'doneWithPath'
    }
    if (m.transferProgress === 1) {
      return 'done'
    }
    switch (m.transferState) {
      case 'downloading':
      case 'mobileSaving':
        return 'downloading'
      default:
        return 'none'
    }
  })

  const downloadPath = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      return m.downloadPath
    }
    return ''
  })

  const download = C.useChatContext(s =>
    C.isMobile ? s.dispatch.messageAttachmentNativeSave : s.dispatch.attachmentDownload
  )
  const onDownload = React.useCallback(() => {
    download(ordinal)
  }, [ordinal, download])

  const openFinder = C.useFSState(s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop)
  const onFinder = React.useCallback(() => {
    downloadPath && openFinder?.(downloadPath)
  }, [openFinder, downloadPath])

  switch (state) {
    case 'doneWithPath':
      return Kb.Styles.isMobile ? null : (
        <Kb.Icon
          className="hover-opacity-full"
          type="iconfont-finder"
          color={Kb.Styles.globalColors.blue}
          fontSize={20}
          hint="Open folder"
          onClick={onFinder}
          style={style}
        />
      )
    case 'done':
      return null
    case 'downloading':
      return (
        <Kb.Icon
          className="hover-opacity-full"
          type="iconfont-download"
          color={Kb.Styles.globalColors.green}
          fontSize={20}
          hint="Downloading"
          style={style}
        />
      )
    case 'none':
      return (
        <Kb.Icon
          className="hover-opacity-full"
          type="iconfont-download"
          color={Kb.Styles.globalColors.blue}
          fontSize={20}
          onClick={onDownload}
          // violates encapsulation but how this works with padding is annoying currently
          style={
            Kb.Styles.isMobile ? Kb.Styles.collapseStyles([style, {left: -48, opacity: 0.6}]) : undefined
          }
          padding={Kb.Styles.isMobile ? 'small' : undefined}
        />
      )
  }
}

export const Transferring = (p: {ratio: number; transferState: T.Chat.MessageAttachmentTransferState}) => {
  const {ratio, transferState} = p
  const isTransferring =
    transferState === 'uploading' || transferState === 'downloading' || transferState === 'mobileSaving'
  return (
    <Kb.Box2
      direction="horizontal"
      style={styles.transferring}
      alignItems="center"
      gap="xtiny"
      gapEnd={true}
      gapStart={true}
    >
      {isTransferring ? (
        <Kb.Text type="BodySmall" negative={true}>
          {transferState === 'uploading' ? 'Uploading' : 'Downloading'}
        </Kb.Text>
      ) : null}
      {isTransferring ? <Kb.ProgressBar ratio={ratio} /> : null}
    </Kb.Box2>
  )
}

export const getEditStyle = (isEditing: boolean) => {
  return isEditing ? sharedStyles.sentEditing : sharedStyles.sent
}

export const Title = () => {
  const ordinal = React.useContext(OrdinalContext)
  const title = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m.decoratedText?.stringValue() ?? m.title : ''
  })

  const styleOverride = React.useMemo(
    () =>
      Kb.Styles.isMobile
        ? {paragraph: {backgroundColor: Kb.Styles.globalColors.black_05_on_white}}
        : undefined,
    []
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleContainer}>
      <Kb.Markdown
        messageType="attachment"
        selectable={true}
        allowFontScaling={true}
        styleOverride={styleOverride}
      >
        {title}
      </Kb.Markdown>
    </Kb.Box2>
  )
}

const CollapseIcon = ({isWhite}: {isWhite: boolean}) => {
  const ordinal = React.useContext(OrdinalContext)
  const isCollapsed = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {isCollapsed} = message
    return isCollapsed
  })
  return (
    <Kb.Icon
      hint="Collapse"
      style={isWhite ? (styles.collapseLabelWhite as any) : (styles.collapseLabel as any) /* TODO FIX */}
      sizeType="Tiny"
      type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  collapseLabel: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  collapseLabelWhite: {color: Kb.Styles.globalColors.white_75},
  titleContainer: {
    alignSelf: 'flex-start',
    paddingTop: Kb.Styles.globalMargins.xxtiny,
  },
  transferring: {
    backgroundColor: Kb.Styles.globalColors.black_50,
    borderRadius: 2,
    left: Kb.Styles.globalMargins.tiny,
    overflow: 'hidden',
    position: 'absolute',
    top: Kb.Styles.globalMargins.tiny,
  },
}))

const useCollapseAction = () => {
  const ordinal = React.useContext(OrdinalContext)
  const toggleMessageCollapse = C.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onCollapse = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      toggleMessageCollapse(T.Chat.numberToMessageID(T.Chat.ordinalToNumber(ordinal)), ordinal)
    },
    [toggleMessageCollapse, ordinal]
  )
  return onCollapse
}

// not showing this for now
const useCollapseIconDesktop = (isWhite: boolean) => {
  const onCollapse = useCollapseAction()
  const collapseIcon = React.useMemo(() => {
    return (
      <Kb.ClickableBox2 onClick={onCollapse}>
        <Kb.Box2 alignSelf="flex-start" direction="horizontal" gap="xtiny">
          <CollapseIcon isWhite={isWhite} />
        </Kb.Box2>
      </Kb.ClickableBox2>
    )
  }, [onCollapse, isWhite])

  return collapseIcon
}
const useCollapseIconMobile = (_isWhite: boolean) => null

export const useCollapseIcon = C.isMobile ? useCollapseIconMobile : useCollapseIconDesktop

export const useAttachmentState = () => {
  const ordinal = React.useContext(OrdinalContext)
  const attachmentPreviewSelect = C.useChatContext(s => s.dispatch.attachmentPreviewSelect)
  const openFullscreen = React.useCallback(() => {
    attachmentPreviewSelect(ordinal)
  }, [attachmentPreviewSelect, ordinal])

  const {fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState} =
    C.useChatContext(
      C.useShallow(s => {
        const m = s.messageMap.get(ordinal)
        const message = m?.type === 'attachment' ? m : missingMessage
        const {isCollapsed, title, fileName: fileNameRaw, transferProgress} = message
        const {deviceType, inlineVideoPlayable, transferState, submitState} = message
        const isEditing = s.editing === ordinal
        const showTitle = !!title
        const fileName =
          deviceType === 'desktop' ? fileNameRaw : `${inlineVideoPlayable ? 'Video' : 'Image'} from mobile`

        return {fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState}
      })
    )

  return {
    fileName,
    isCollapsed,
    isEditing,
    openFullscreen,
    showTitle,
    submitState,
    transferProgress,
    transferState,
  }
}

export const Collapsed = () => {
  const onCollapse = useCollapseAction()
  const collapseIcon = useCollapseIcon(false)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text type="BodyTiny" onClick={onCollapse}>
        Collapsed
      </Kb.Text>
      {collapseIcon}
    </Kb.Box2>
  )
}
