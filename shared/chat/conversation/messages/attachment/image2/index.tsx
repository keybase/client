import * as Kb from '@/common-adapters'
import * as React from 'react'
import ImageImpl from './imageimpl'
import {
  ShowToastAfterSaving,
  Title,
  useAttachmentState,
  useCollapseIcon,
  Collapsed,
  Transferring,
  TransferIcon,
} from '../shared'

type Props = {
  showPopup: () => void
}

const Image2 = React.memo(function Image2(p: Props) {
  const {showPopup} = p
  const {fileName, isCollapsed, showTitle, openFullscreen, transferState, transferProgress} =
    useAttachmentState()
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
        <Kb.Box2
          direction="horizontal"
          alignSelf="flex-start"
          gap={Kb.Styles.isMobile ? undefined : 'small'}
          alignItems="center"
        >
          <Kb.Box2
            direction="vertical"
            style={styles.contentContainer}
            alignSelf="flex-start"
            alignItems="flex-start"
            gap="xxtiny"
          >
            <ShowToastAfterSaving transferState={transferState} toastTargetRef={toastTargetRef} />
            <Kb.ClickableBox
              onClick={openFullscreen}
              onLongPress={showPopup}
              style={styles.imageContainer}
              ref={toastTargetRef}
            >
              <ImageImpl />
            </Kb.ClickableBox>
            {showTitle ? <Title /> : null}
            <Transferring transferState={transferState} ratio={transferProgress} />
          </Kb.Box2>
          <TransferIcon style={Kb.Styles.isMobile ? styles.transferIcon : undefined} />
        </Kb.Box2>
      </>
    )
  }, [filename, openFullscreen, showPopup, showTitle, transferState, transferProgress])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed /> : content}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => {
  return {
    container: {alignSelf: 'center'},
    contentContainer: {
      backgroundColor: Kb.Styles.globalColors.black_05_on_white,
      borderRadius: Kb.Styles.borderRadius,
      maxWidth: Kb.Styles.isMobile ? '100%' : 330,
      padding: 3,
      position: 'relative',
    },
    imageContainer: {alignSelf: 'center'},
    transferIcon: {left: -32, position: 'absolute'},
  } as const
})

export default Image2
