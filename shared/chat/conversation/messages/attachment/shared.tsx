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
export const maxWidth = Styles.isMobile ? Math.min(320, Styles.dimensionWidth - 85) : 320

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

// TOO remofe
export const getEditStyle = (isEditing: boolean, isHighlighted?: boolean) => {
  if (isHighlighted) {
    return Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  }
  return isEditing ? sharedStyles.sentEditing : sharedStyles.sent
}

export const Title = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const title = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    return m?.type === 'attachment' ? m.title : ''
  })
  return (
    <Kb.Markdown messageType="attachment" selectable={true} allowFontScaling={true}>
      {title}
    </Kb.Markdown>
  )
}

const CollapseLabel = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {filename, isCollapsed} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {isCollapsed, fileName, deviceType} = message
    const mobileImageFilename = deviceType === 'mobile'
    const filename = mobileImageFilename ? 'Image from mobile' : fileName
    return {filename, isCollapsed}
  }, shallowEqual)
  return (
    <>
      <Kb.Text type="BodyTiny" lineClamp={1}>
        {filename}
      </Kb.Text>
      <Kb.Icon sizeType="Tiny" type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'} />
    </>
  )
}

export const useCollapseLabel = () => {
  const getIds = React.useContext(GetIdsContext)
  const dispatch = Container.useDispatch()
  const onCollapse = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createToggleMessageCollapse({conversationIDKey, messageID: ordinal}))
  }, [dispatch, getIds])

  const collapseLabel = React.useMemo(() => {
    return (
      <Kb.ClickableBox2 onClick={onCollapse}>
        <Kb.Box2 alignSelf="flex-start" direction="horizontal" gap="xtiny">
          <CollapseLabel />
        </Kb.Box2>
      </Kb.ClickableBox2>
    )
  }, [onCollapse])

  return collapseLabel
}

export const useAttachmentRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const dispatch = Container.useDispatch()
  const getIds = React.useContext(GetIdsContext)
  const openFullscreen = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createAttachmentPreviewSelect({conversationIDKey, ordinal}))
  }, [dispatch, getIds])

  const {isCollapsed, isEditing, showTitle} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {isCollapsed, title} = message
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    const isEditing = !!(editInfo && editInfo.ordinal === ordinal)
    const showTitle = !!title
    return {isCollapsed, isEditing, showTitle}
  }, shallowEqual)

  return {isCollapsed, isEditing, openFullscreen, showTitle}
}
