import * as React from 'react'
import * as Kb from '@/common-adapters'
import VideoImpl from './videoimpl'
import {
  Title,
  useAttachmentState,
  Collapsed,
  useCollapseIcon,
  Transferring,
  TransferIcon,
  ShowToastAfterSaving,
} from '../shared'

type Props = {
  showPopup: () => void
}

const Video = React.memo(function Video(p: Props) {
  const {showPopup} = p
  const r = useAttachmentState()
  const {transferState, transferProgress, submitState} = r
  const {fileName, isCollapsed, showTitle, openFullscreen} = r
  const containerStyle = styles.container
  const collapseIcon = useCollapseIcon(false)

  const filename = React.useMemo(() => {
    return Kb.Styles.isMobile || !fileName ? null : (
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="xtiny">
        <Kb.Text type="BodySmall">{fileName}</Kb.Text>
        {collapseIcon}
      </Kb.Box2>
    )
  }, [collapseIcon, fileName])

  const toastTargetRef = React.useRef<Kb.MeasureRef>(null)

  const content = React.useMemo(() => {
    return (
      <>
        {filename}
        <Kb.Box2Measure
          direction="horizontal"
          alignSelf="flex-start"
          gap={Kb.Styles.isMobile ? undefined : 'small'}
          alignItems="center"
          ref={toastTargetRef}
        >
          <Kb.Box2
            direction="vertical"
            style={styles.contentContainer}
            alignSelf="flex-start"
            alignItems="center"
            gap="xxtiny"
          >
            <ShowToastAfterSaving transferState={transferState} toastTargetRef={toastTargetRef} />
            <VideoImpl
              openFullscreen={openFullscreen}
              showPopup={showPopup}
              allowPlay={transferState !== 'uploading' && submitState !== 'pending'}
            />
            {showTitle ? <Title /> : null}
            <Transferring transferState={transferState} ratio={transferProgress} />
          </Kb.Box2>
          <TransferIcon style={Kb.Styles.isMobile ? styles.transferIcon : undefined} />
        </Kb.Box2Measure>
      </>
    )
  }, [openFullscreen, showPopup, showTitle, filename, transferProgress, transferState, submitState])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed /> : content}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'center',
        paddingRight: Kb.Styles.isMobile ? 0 : Kb.Styles.globalMargins.tiny,
        position: 'relative',
      },
      contentContainer: {
        backgroundColor: Kb.Styles.globalColors.black_05_on_white,
        borderRadius: Kb.Styles.borderRadius,
        maxWidth: Kb.Styles.isMobile ? '100%' : 356 + 3 * 2,
        padding: 3,
        position: 'relative',
      },
      transferIcon: {left: -32, position: 'absolute'},
    }) as const
)

export default Video
