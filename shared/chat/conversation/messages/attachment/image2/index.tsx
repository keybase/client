import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext, GetIdsContext} from '../../ids-context'
import ImageImpl from './imageimpl'
import shallowEqual from 'shallowequal'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted: boolean
}

const CollapseLabel = (p: {filename: string; isCollapsed: boolean}) => {
  const {filename, isCollapsed} = p
  return (
    <Kb.Box2 alignSelf="flex-start" direction="horizontal" gap="xtiny">
      <Kb.Text type="BodyTiny" lineClamp={1}>
        {filename}
      </Kb.Text>
      <Kb.Icon sizeType="Tiny" type={isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'} />
    </Kb.Box2>
  )
}

const Title = (p: {title: string}) => {
  const {title} = p
  return (
    <Kb.Markdown messageType="attachment" selectable={true} allowFontScaling={true}>
      {title}
    </Kb.Markdown>
  )
}

const missingMessage = Constants.makeMessageAttachment()
const Image2 = React.memo(function Image2(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {filename, isCollapsed, isEditing, title} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {isCollapsed, fileName, title, deviceType} = message
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    const isEditing = !!(editInfo && editInfo.ordinal === ordinal)
    const mobileImageFilename = deviceType === 'mobile'
    const filename = mobileImageFilename ? 'Image from mobile' : fileName
    return {filename, isCollapsed, isEditing, title}
  }, shallowEqual)

  const dispatch = Container.useDispatch()
  const getIds = React.useContext(GetIdsContext)
  const onClick = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createAttachmentPreviewSelect({conversationIDKey, ordinal}))
  }, [dispatch, getIds])
  const onCollapse = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(
      Chat2Gen.createToggleMessageCollapse({
        collapse: !isCollapsed,
        conversationIDKey,
        messageID: ordinal,
      })
    )
  }, [dispatch, isCollapsed, getIds])

  const containerStyle = isHighlighted || isEditing ? styles.containerHighlighted : styles.container

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      <Kb.ClickableBox2 onClick={onCollapse}>
        <CollapseLabel isCollapsed={isCollapsed} filename={filename} />
      </Kb.ClickableBox2>
      {isCollapsed ? null : (
        <Kb.Box2
          direction="vertical"
          style={styles.contentContainer}
          alignSelf="flex-start"
          alignItems="flex-start"
        >
          <Kb.ClickableBox onClick={onClick} onLongPress={toggleMessageMenu} style={styles.imageContainer}>
            <ImageImpl />
          </Kb.ClickableBox>
          {title ? <Title title={title} /> : null}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => {
  return {
    container: {alignSelf: 'center', paddingRight: Styles.globalMargins.tiny},
    containerHighlighted: {
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.yellowLight,
      paddingRight: Styles.globalMargins.tiny,
    },
    contentContainer: {
      backgroundColor: Styles.globalColors.black_05_on_white,
      borderRadius: Styles.borderRadius,
      maxWidth: Styles.isMobile ? '100%' : 330,
      padding: Styles.globalMargins.xtiny,
      position: 'relative',
    },
    imageContainer: {alignSelf: 'center'},
  } as const
})

export default Image2
