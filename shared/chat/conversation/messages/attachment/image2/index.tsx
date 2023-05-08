import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import ImageImpl from './imageimpl'
import {
  ShowToastAfterSaving,
  Title,
  useAttachmentRedux,
  useCollapseIcon,
  Collapsed,
  Transferring,
} from '../shared'

type Props = {
  toggleMessageMenu: () => void
}

const Image2 = React.memo(function Image2(p: Props) {
  const {toggleMessageMenu} = p
  const {fileName, isCollapsed, showTitle, openFullscreen, transferState, transferProgress} =
    useAttachmentRedux()
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
          alignItems="flex-start"
          gap="xxtiny"
        >
          <ShowToastAfterSaving transferState={transferState} />
          <Kb.ClickableBox
            onClick={openFullscreen}
            onLongPress={toggleMessageMenu}
            style={styles.imageContainer}
          >
            <ImageImpl />
          </Kb.ClickableBox>
          {showTitle ? <Title /> : null}
          <Transferring transferState={transferState} ratio={transferProgress} />
        </Kb.Box2>
      </>
    )
  }, [filename, openFullscreen, toggleMessageMenu, showTitle, transferState, transferProgress])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {isCollapsed ? <Collapsed /> : content}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => {
  return {
    container: {
      alignSelf: 'center',
    },
    contentContainer: {
      backgroundColor: Styles.globalColors.black_05_on_white,
      borderRadius: Styles.borderRadius,
      maxWidth: Styles.isMobile ? '100%' : 330,
      padding: 3,
      position: 'relative',
    },
    imageContainer: {alignSelf: 'center'},
  } as const
})

export default Image2
