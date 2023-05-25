import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'
import {ConvoIDContext, OrdinalContext, GetIdsContext} from '../ids-context'
import {sharedStyles} from '../shared-styles'

type Props = {
  transferState: Types.MessageAttachmentTransferState
}

// this is a function of how much space is taken up by the rest of the elements
export const maxWidth = Styles.isMobile ? 301 : 320
export const maxHeight = 320

export const missingMessage = Constants.makeMessageAttachment()

export const ShowToastAfterSaving = Container.isMobile
  ? ({transferState}: Props) => {
      const [showingToast, setShowingToast] = React.useState(false)
      const [wasSaving, setWasSaving] = React.useState(false)
      const setShowingToastFalseLater = Kb.useTimeout(() => setShowingToast(false), 1500)
      React.useEffect(() => {
        transferState === 'mobileSaving' && setWasSaving(true)
      }, [transferState])
      React.useEffect(() => {
        if (wasSaving && !transferState) {
          setWasSaving(false)
          setShowingToast(true)
          setShowingToastFalseLater()
        }
      }, [wasSaving, transferState, setShowingToast, setShowingToastFalseLater])
      return showingToast ? (
        <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={showingToast} />
      ) : null
    }
  : () => null

export const Transferring = (p: {ratio: number; transferState: Types.MessageAttachmentTransferState}) => {
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
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const title = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    return m?.type === 'attachment' ? m.decoratedText?.stringValue() ?? m.title ?? '' : ''
  })

  const styleOverride = React.useMemo(
    () =>
      Styles.isMobile
        ? ({paragraph: {backgroundColor: Styles.globalColors.black_05_on_white}} as any)
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
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const isCollapsed = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
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

const styles = Styles.styleSheetCreate(() => ({
  collapseLabel: {backgroundColor: Styles.globalColors.fastBlank},
  collapseLabelWhite: {color: Styles.globalColors.white_75},
  titleContainer: {
    alignSelf: 'flex-start',
    paddingTop: Styles.globalMargins.xxtiny,
  },
  transferring: {
    backgroundColor: Styles.globalColors.black_50,
    borderRadius: 2,
    left: Styles.globalMargins.tiny,
    overflow: 'hidden',
    position: 'absolute',
    top: Styles.globalMargins.tiny,
  },
}))

const useCollapseAction = () => {
  const getIds = React.useContext(GetIdsContext)
  const dispatch = Container.useDispatch()
  const onCollapse = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      const {conversationIDKey, ordinal} = getIds()
      dispatch(Chat2Gen.createToggleMessageCollapse({conversationIDKey, messageID: ordinal, ordinal}))
    },
    [dispatch, getIds]
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

export const useCollapseIcon = Container.isMobile ? useCollapseIconMobile : useCollapseIconDesktop

export const useAttachmentRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const dispatch = Container.useDispatch()
  const getIds = React.useContext(GetIdsContext)
  const openFullscreen = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createAttachmentPreviewSelect({conversationIDKey, ordinal}))
  }, [dispatch, getIds])

  const {fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState} =
    Container.useSelector(state => {
      const m = Constants.getMessage(state, conversationIDKey, ordinal)
      const message = m?.type === 'attachment' ? m : missingMessage
      const {isCollapsed, title, fileName: fileNameRaw, transferProgress} = message
      const {deviceType, inlineVideoPlayable, transferState, submitState} = message
      const editInfo = Constants.getEditInfo(state, conversationIDKey)
      const isEditing = !!(editInfo && editInfo.ordinal === ordinal)
      const showTitle = !!title
      const fileName =
        deviceType === 'desktop' ? fileNameRaw : `${inlineVideoPlayable ? 'Video' : 'Image'} from mobile`

      return {fileName, isCollapsed, isEditing, showTitle, submitState, transferProgress, transferState}
    }, shallowEqual)

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
