import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import VideoImpl from './videoimpl'
import {Title, useAttachmentRedux, Collapsed, useCollapseIcon, Transferring} from '../shared'

type Props = {
  toggleMessageMenu: () => void
}

const Video = React.memo(function Video(p: Props) {
  const {toggleMessageMenu} = p
  const r = useAttachmentRedux()
  const {transferState, transferProgress, submitState} = r
  const {fileName, isCollapsed, showTitle, openFullscreen} = r
  const containerStyle = styles.container
  const collapseIcon = useCollapseIcon(false)

  const filename = React.useMemo(() => {
    return Styles.isMobile || !fileName ? null : (
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{fileName}</Kb.Text>
        {collapseIcon}
      </Kb.Box2>
    )
  }, [collapseIcon, fileName])

  const content = React.useMemo(() => {
    return (
      <>
        {filename}
        <Kb.Box2
          direction="vertical"
          style={styles.contentContainer}
          alignSelf="flex-start"
          alignItems="center"
          gap="xxtiny"
        >
          <VideoImpl
            openFullscreen={openFullscreen}
            toggleMessageMenu={toggleMessageMenu}
            allowPlay={transferState !== 'uploading' && submitState !== 'pending'}
          />
          {showTitle ? <Title /> : null}
          <Transferring transferState={transferState} ratio={transferProgress} />
        </Kb.Box2>
      </>
    )
  }, [openFullscreen, toggleMessageMenu, showTitle, filename, transferProgress, transferState, submitState])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed /> : content}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {alignSelf: 'center', paddingRight: Styles.globalMargins.tiny, position: 'relative'},
      contentContainer: {
        backgroundColor: Styles.globalColors.black_05_on_white,
        borderRadius: Styles.borderRadius,
        maxWidth: Styles.isMobile ? '100%' : 330,
        padding: 3,
        position: 'relative',
      },
    } as const)
)

export default Video
