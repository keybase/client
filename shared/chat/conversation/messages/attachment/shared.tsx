import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useOrdinal} from '../ids-context'
import {sharedStyles} from '../shared-styles'
import {Keyboard} from 'react-native'
import {useFSState} from '@/stores/fs'

type Props = {
  transferState: T.Chat.MessageAttachmentTransferState
  toastTargetRef?: React.RefObject<Kb.MeasureRef | null>
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = Kb.Styles.isMobile ? Math.min(356, Kb.Styles.dimensionWidth - 70) : 356
export const maxHeight = 320

export const missingMessage = Chat.makeMessageAttachment()

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
  C.Router2.useSafeFocusEffect(() => {
    setAllowToast(true)
    return () => {
      setAllowToast(false)
    }
  })

  return allowToast && showingToast ? (
    <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={true} toastTargetRef={toastTargetRef} />
  ) : null
}

export const TransferIcon = (p: {style: Kb.Styles.StylesCrossPlatform}) => {
  const {style} = p
  const ordinal = useOrdinal()
  const {state, downloadPath, download} = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      let state: 'none' | 'doneWithPath' | 'done' | 'downloading' = 'none'
      let downloadPath = ''
      if (m?.type === 'attachment') {
        downloadPath = m.downloadPath ?? ''
        if (downloadPath.length) {
          state = 'doneWithPath'
        } else if (m.transferProgress === 1) {
          state = 'done'
        } else {
          switch (m.transferState) {
            case 'downloading':
            case 'mobileSaving':
              state = 'downloading'
              break
            default:
          }
        }
      }
      const download = C.isMobile ? s.dispatch.messageAttachmentNativeSave : s.dispatch.attachmentDownload
      return {download, downloadPath, state}
    })
  )
  const onDownload = () => {
    download(ordinal)
  }

  const openFinder = useFSState(s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop)
  const onFinder = () => {
    downloadPath && openFinder?.(downloadPath)
  }

  switch (state) {
    case 'doneWithPath':
      return Kb.Styles.isMobile ? null : (
        <Kb.Icon2
          className="hover-opacity-full"
          type="iconfont-finder"
          color={Kb.Styles.globalColors.blue}
          fontSize={20}
          onClick={onFinder}
          style={style}
        />
      )
    case 'done':
      return null
    case 'downloading':
      return (
        <Kb.Icon2
          className="hover-opacity-full"
          type="iconfont-download"
          color={Kb.Styles.globalColors.green}
          fontSize={20}
          style={style}
        />
      )
    case 'none':
      return (
        <Kb.Icon2
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
      overflow="hidden"
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

  const styleOverride = Kb.Styles.isMobile
    ? {paragraph: {backgroundColor: Kb.Styles.globalColors.black_05_on_white}}
    : undefined

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
    <Kb.Icon2
      style={isWhite ? (styles.collapseLabelWhite as Kb.IconStyle) : undefined}
      sizeType="Tiny"
      type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({

  collapseLabelWhite: {color: Kb.Styles.globalColors.white_75},
  titleContainer: {
    alignSelf: 'flex-start',
    paddingTop: Kb.Styles.globalMargins.xxtiny,
  },
  transferring: {
    backgroundColor: Kb.Styles.globalColors.black_50,
    borderRadius: 2,
    left: Kb.Styles.globalMargins.tiny,
    position: 'absolute',
    top: Kb.Styles.globalMargins.tiny,
  },
}))

const useCollapseAction = () => {
  const ordinal = useOrdinal()
  const toggleMessageCollapse = Chat.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onCollapse = () => {
    toggleMessageCollapse(T.Chat.numberToMessageID(T.Chat.ordinalToNumber(ordinal)), ordinal)
  }
  return onCollapse
}

// not showing this for now
const useCollapseIconDesktop = (isWhite: boolean) => {
  const onCollapse = useCollapseAction()
  return (
    <Kb.ClickableBox2 onClick={onCollapse}>
      <Kb.Box2 alignSelf="flex-start" direction="horizontal" gap="xtiny">
        <CollapseIcon isWhite={isWhite} />
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
}
const useCollapseIconMobile = (_isWhite: boolean) => null

export const useCollapseIcon = C.isMobile ? useCollapseIconMobile : useCollapseIconDesktop

export const useAttachmentState = () => {
  const ordinal = useOrdinal()
  const {attachmentPreviewSelect, fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState} =
    Chat.useChatContext(
      C.useShallow(s => {
        const m = s.messageMap.get(ordinal)
        const message = m?.type === 'attachment' ? m : missingMessage
        const {isCollapsed, title, fileName: fileNameRaw, transferProgress} = message
        const {deviceType, inlineVideoPlayable, transferState, submitState} = message
        const isEditing = s.editing === ordinal
        const showTitle = !!title
        const fileName =
          deviceType === 'desktop' ? fileNameRaw : `${inlineVideoPlayable ? 'Video' : 'Image'} from mobile`

        return {attachmentPreviewSelect: s.dispatch.attachmentPreviewSelect, fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState}
      })
    )
  const openFullscreen = () => {
    Keyboard.dismiss()
    attachmentPreviewSelect(ordinal)
  }

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
