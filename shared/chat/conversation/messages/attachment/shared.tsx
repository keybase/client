import * as C from '@/constants'
import * as Chat from '@/constants/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useOrdinal} from '../ids-context'
import {sharedStyles} from '../shared-styles'
import {Keyboard} from 'react-native'
import {useFSState} from '@/constants/fs'

type Props = {
  transferState: T.Chat.MessageAttachmentTransferState
  toastTargetRef?: React.RefObject<Kb.MeasureRef | null>
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = Kb.Styles.isMobile ? Math.min(356, Kb.Styles.dimensionWidth - 70) : 356
export const maxHeight = 320

export const missingMessage = Chat.makeMessageAttachment()

export const messageAttachmentHasProgress = (transferState: T.Chat.MessageAttachmentTransferState) => {
  return !!transferState && transferState !== 'remoteUploading' && transferState !== 'mobileSaving'
}

export const ShowToastAfterSaving = ({transferState, toastTargetRef}: Props) => {
  const [showingToast, setShowingToast] = React.useState(false)
  const lastTransferStateRef = React.useRef(transferState)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
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
  }, [transferState])

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
  const ordinal = useOrdinal()
  const {attachmentType, downloadPath, state} = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      if (m?.type !== 'attachment') {
        return {attachmentType: 'file' as const, downloadPath: '', state: 'none' as const}
      }

      if (m.downloadPath?.length) {
        return {attachmentType: m.attachmentType, downloadPath: m.downloadPath, state: 'doneWithPath' as const}
      }
      if (m.transferProgress === 1) {
        return {attachmentType: m.attachmentType, downloadPath: m.downloadPath, state: 'done' as const}
      }
      switch (m.transferState) {
        case 'downloading':
        case 'mobileSaving':
          return {attachmentType: m.attachmentType, downloadPath: m.downloadPath, state: 'downloading' as const}
        default:
          return {attachmentType: m.attachmentType, downloadPath: m.downloadPath, state: 'none' as const}
      }
    })
  )

  const {attachmentDownload, messageAttachmentNativeSave, messageAttachmentNativeShare} = Chat.useChatContext(
    s => s.dispatch
  )
  const onDownload = React.useCallback(() => {
    if (C.isMobile) {
      if (attachmentType === 'audio') {
        messageAttachmentNativeShare(ordinal)
      } else {
        messageAttachmentNativeSave(ordinal)
      }
    } else {
      attachmentDownload(ordinal)
    }
  }, [ordinal, attachmentType, messageAttachmentNativeShare, messageAttachmentNativeSave, attachmentDownload])

  const openFinder = useFSState(s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop)
  const onFinder = React.useCallback(() => {
    downloadPath && openFinder?.(downloadPath)
  }, [openFinder, downloadPath])
  const isMobileAudio = C.isMobile && attachmentType === 'audio'
  const mobileStyle = Kb.Styles.collapseStyles([style, {left: -48, opacity: 0.6}])
  const renderIcon = (
    type: Kb.IconType,
    color: string,
    hint?: string,
    onClick?: () => void,
    useMobileStyle?: boolean
  ) => (
    <Kb.Icon
      className="hover-opacity-full"
      type={type}
      color={color}
      fontSize={20}
      hint={hint}
      onClick={onClick}
      style={useMobileStyle ? mobileStyle : style}
      padding={useMobileStyle ? 'small' : undefined}
    />
  )

  switch (state) {
    case 'doneWithPath':
      if (isMobileAudio) {
        return renderIcon('iconfont-share', Kb.Styles.globalColors.blue, 'Share', onDownload, true)
      }
      if (Kb.Styles.isMobile) {
        return null
      }
      return renderIcon('iconfont-finder', Kb.Styles.globalColors.blue, 'Open folder', onFinder)
    case 'done':
      return null
    case 'downloading':
      return renderIcon('iconfont-download', Kb.Styles.globalColors.green, 'Downloading')
    case 'none':
      return renderIcon(
        isMobileAudio ? 'iconfont-share' : 'iconfont-download',
        Kb.Styles.globalColors.blue,
        undefined,
        onDownload,
        Kb.Styles.isMobile
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
  const ordinal = useOrdinal()
  const title = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? (m.decoratedText?.stringValue() ?? m.title) : ''
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
  const ordinal = useOrdinal()
  const isCollapsed = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {isCollapsed} = message
    return isCollapsed
  })
  return (
    <Kb.Icon
      hint="Collapse"
      style={isWhite ? (styles.collapseLabelWhite as Kb.IconStyle) : (styles.collapseLabel as Kb.IconStyle)}
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
  const ordinal = useOrdinal()
  const toggleMessageCollapse = Chat.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onCollapse = React.useCallback(() => {
    toggleMessageCollapse(T.Chat.numberToMessageID(T.Chat.ordinalToNumber(ordinal)), ordinal)
  }, [toggleMessageCollapse, ordinal])
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
  const ordinal = useOrdinal()
  const attachmentPreviewSelect = Chat.useChatContext(s => s.dispatch.attachmentPreviewSelect)
  const openFullscreen = React.useCallback(() => {
    Keyboard.dismiss()
    attachmentPreviewSelect(ordinal)
  }, [attachmentPreviewSelect, ordinal])

  const {fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState} =
    Chat.useChatContext(
      C.useShallow(s => {
        const m = s.messageMap.get(ordinal)
        const message = m?.type === 'attachment' ? m : missingMessage
        const {decoratedText, isCollapsed, title, fileName: fileNameRaw, transferProgress} = message
        const {deviceType, inlineVideoPlayable, transferState, submitState} = message
        const isEditing = s.editing === ordinal
        const showTitle = !!(decoratedText?.stringValue() ?? title)
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
