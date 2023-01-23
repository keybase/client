import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import VideoImpl from './videoimpl'
import {useCollapseLabel, Title, useAttachmentRedux} from '../shared'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const Video = React.memo(function Video(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p
  const {isCollapsed, showTitle, onClick} = useAttachmentRedux()
  const containerStyle = isHighlighted ? styles.containerHighlighted : styles.container
  const collapseLabel = useCollapseLabel()
  // TODO
  // <ShowToastAfterSaving transferState={this.props.transferState} />
  const content = React.useMemo(() => {
    return (
      <Kb.Box2
        direction="vertical"
        style={styles.contentContainer}
        alignSelf="flex-start"
        alignItems="flex-start"
      >
        <Kb.ClickableBox onClick={onClick} onLongPress={toggleMessageMenu} style={styles.videoContainer}>
          <VideoImpl />
        </Kb.ClickableBox>
        {showTitle ? <Title /> : null}
      </Kb.Box2>
    )
  }, [onClick, toggleMessageMenu, showTitle])
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
      videoContainer: {},
    } as const)
)

export default Video
