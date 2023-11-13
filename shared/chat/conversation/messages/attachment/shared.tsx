import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import type * as T from '../../../../constants/types'
import {OrdinalContext} from '../ids-context'
import {sharedStyles} from '../shared-styles'

type Props = {
  transferState: T.Chat.MessageAttachmentTransferState
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = Kb.Styles.isMobile ? Math.min(320, Kb.Styles.dimensionWidth - 60) : 320
export const maxHeight = 320

export const missingMessage = C.Chat.makeMessageAttachment()

export const ShowToastAfterSaving = C.isMobile
  ? ({transferState}: Props) => {
      const [showingToast, setShowingToast] = React.useState(false)
      const [wasSaving, setWasSaving] = React.useState(false)
      const [lastWasSaving, setLastWasSaving] = React.useState(wasSaving)
      const setShowingToastFalseLater = Kb.useTimeout(() => setShowingToast(false), 1500)
      const [lastTS, setLastTS] = React.useState(transferState)
      if (lastTS !== transferState) {
        setLastTS(transferState)
        if (transferState === 'mobileSaving') {
          setWasSaving(true)
        }
      }

      if (lastWasSaving !== wasSaving || lastTS !== transferState) {
        setLastTS(transferState)
        setLastWasSaving(wasSaving)
        if (wasSaving && !transferState) {
          setWasSaving(false)
          setShowingToast(true)
          setShowingToastFalseLater()
        }
      }
      return showingToast ? (
        <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={showingToast} />
      ) : null
    }
  : () => null

export const Transferring = (p: {ratio: number; transferState: T.Chat.MessageAttachmentTransferState}) => {
  const {ratio, transferState} = p
  const isTransferring =
    transferState === 'uploading' || transferState === 'downloading' || transferState === 'mobileSaving'
  if (!isTransferring) {
    return null
  }
  return (
    <Kb.Box2
      direction="horizontal"
      style={styles.transferring}
      alignItems="center"
      gap="xtiny"
      gapEnd={true}
      gapStart={true}
    >
      <Kb.Text type="BodySmall" negative={true}>
        {transferState === 'uploading' ? 'Uploading' : 'Downloading'}
      </Kb.Text>
      <Kb.ProgressBar ratio={ratio} />
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
        ? ({paragraph: {backgroundColor: Kb.Styles.globalColors.black_05_on_white}} as any)
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
      style={isWhite ? styles.collapseLabelWhite : (styles.collapseLabel as any)}
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
      toggleMessageCollapse(ordinal, ordinal)
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

export const useAttachmentRedux = () => {
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
