import * as C from '@/constants'
import {clampImageSize} from '@/constants/chat/helpers'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {sharedStyles} from '../shared-styles'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {useConversationAttachmentActions} from '../../attachment-actions'
import {useConversationThreadMessageActions} from '../../thread-context'

type Props = {
  transferState: T.Chat.MessageAttachmentTransferState
  toastTargetRef?: React.RefObject<Kb.MeasureRef | null>
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = isMobile ? Math.min(356, Kb.Styles.dimensionWidth - 70) : 356
export const maxHeight = 320

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
        (lastTransferStateRef.current === 'mobileSaving' ||
          (!isMobile && lastTransferStateRef.current === 'downloading')) &&
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

export const TransferIcon = (p: {
  message: T.Chat.MessageAttachment
  ordinal: T.Chat.Ordinal
  style: Kb.Styles.StylesCrossPlatform
}) => {
  const {message, ordinal, style} = p
  const hasMessageID = !!T.Chat.messageIDToNumber(message.id)
  let state: 'none' | 'doneWithPath' | 'done' | 'downloading' = 'none'
  const downloadPath = message.downloadPath ?? ''
  if (downloadPath.length) {
    state = 'doneWithPath'
  } else if (message.transferProgress === 1) {
    state = 'done'
  } else {
    switch (message.transferState) {
      case 'downloading':
      case 'mobileSaving':
        state = 'downloading'
        break
      default:
    }
  }
  const {attachmentDownload, messageAttachmentNativeSave, messageAttachmentNativeShare} =
    useConversationAttachmentActions()
  const isMobileAudio = isMobile && message.attachmentType === 'audio'
  const onDownload = () => {
    if (!hasMessageID) {
      return
    }
    if (isMobile) {
      if (isMobileAudio) {
        messageAttachmentNativeShare(ordinal)
      } else {
        messageAttachmentNativeSave(ordinal)
      }
    } else {
      attachmentDownload(ordinal)
    }
  }

  const onFinder = () => {
    if (downloadPath) {
      openLocalPathInSystemFileManagerDesktop(downloadPath)
    }
  }
  const mobileStyle = Kb.Styles.collapseStyles([style, {left: -48, opacity: 0.6}])

  switch (state) {
    case 'doneWithPath':
      if (isMobileAudio) {
        return (
          <Kb.Icon
            className="hover-opacity-full"
            type="iconfont-share"
            color={Kb.Styles.globalColors.blue}
            fontSize={20}
            hint="Share"
            onClick={onDownload}
            style={mobileStyle}
            padding="small"
          />
        )
      }
      return isMobile ? null : (
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
      return hasMessageID ? (
        <Kb.Icon
          className="hover-opacity-full"
          type={isMobileAudio ? 'iconfont-share' : 'iconfont-download'}
          color={Kb.Styles.globalColors.blue}
          fontSize={20}
          onClick={onDownload}
          style={isMobile ? mobileStyle : undefined}
          padding={isMobile ? 'small' : undefined}
        />
      ) : null
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

export const getAttachmentDisplayFileName = (message: T.Chat.MessageAttachment) => {
  return message.deviceType === 'desktop'
    ? message.fileName
    : `${message.inlineVideoPlayable ? 'Video' : 'Image'} from mobile`
}

export const getAttachmentPreviewSize = (
  message: T.Chat.MessageAttachment,
  useSquareFallback = false
) => {
  const {fileURL, previewHeight, previewWidth} = message
  let {previewURL} = message
  let {height, width} = clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
  // This is mostly a sanity check and also allows us to handle HEIC even though the go side doesn't
  // understand.
  if (useSquareFallback && (height === 0 || width === 0)) {
    height = 320
    width = 320
  }
  if (!previewURL) {
    previewURL = fileURL
  }
  return {height, previewURL, width}
}

export const Title = ({message}: {message: T.Chat.MessageAttachment}) => {
  const title = message.decoratedText?.stringValue() ?? message.title

  const styleOverride = isMobile
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

const CollapseIcon = ({isCollapsed, isWhite}: {isCollapsed: boolean; isWhite: boolean}) => {
  return (
    <Kb.Icon
      style={isWhite ? styles.collapseLabelWhite : undefined}
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

const useCollapseAction = (ordinal: T.Chat.Ordinal) => {
  const {toggleMessageCollapse} = useConversationThreadMessageActions()
  const onCollapse = () => {
    toggleMessageCollapse(T.Chat.numberToMessageID(T.Chat.ordinalToNumber(ordinal)), ordinal)
  }
  return onCollapse
}

// not showing this for now
const useCollapseIconDesktop = (ordinal: T.Chat.Ordinal, isCollapsed: boolean, isWhite: boolean) => {
  const onCollapse = useCollapseAction(ordinal)
  return (
    <Kb.ClickableBox direction="horizontal" alignSelf="flex-start" gap="xtiny" onClick={onCollapse}>
      <CollapseIcon isCollapsed={isCollapsed} isWhite={isWhite} />
    </Kb.ClickableBox>
  )
}
const useCollapseIconMobile = (_ordinal: T.Chat.Ordinal, _isCollapsed: boolean, _isWhite: boolean) => null

export const useCollapseIcon = isMobile ? useCollapseIconMobile : useCollapseIconDesktop

export const Collapsed = ({isCollapsed, ordinal}: {isCollapsed: boolean; ordinal: T.Chat.Ordinal}) => {
  const onCollapse = useCollapseAction(ordinal)
  const collapseIcon = useCollapseIcon(ordinal, isCollapsed, false)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Text type="BodyTiny" onClick={onCollapse}>
        Collapsed
      </Kb.Text>
      {collapseIcon}
    </Kb.Box2>
  )
}
