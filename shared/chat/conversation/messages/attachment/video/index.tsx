import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import VideoImpl from './videoimpl'
import {useCollapseLabel, Title, useAttachmentRedux} from '../shared'
// import {ConvoIDContext, OrdinalContext} from '../../ids-context'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const Video = React.memo(function Video(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p
  const {isCollapsed, showTitle, openFullscreen} = useAttachmentRedux()
  // const conversationIDKey = React.useContext(ConvoIDContext)
  // const ordinal = React.useContext(OrdinalContext)
  const containerStyle = isHighlighted ? styles.containerHighlighted : styles.container
  const collapseLabel = useCollapseLabel()
  // TODO
  //onClick={onClick}
  const content = React.useMemo(() => {
    return (
      <Kb.Box2
        direction="vertical"
        style={styles.contentContainer}
        alignSelf="flex-start"
        alignItems="flex-start"
        gap="xxtiny"
      >
        <VideoImpl openFullscreen={openFullscreen} toggleMessageMenu={toggleMessageMenu} />
        {showTitle ? <Title /> : null}
      </Kb.Box2>
    )
  }, [openFullscreen, toggleMessageMenu, showTitle])
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {collapseLabel}
      {isCollapsed ? null : content}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
        padding: Styles.globalMargins.tiny,
        position: 'relative',
      },
      overlay: {
        ...Styles.globalStyles.fillAbsolute,
      },
    } as const)
)

export default Video
