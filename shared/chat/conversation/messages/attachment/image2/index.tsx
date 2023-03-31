import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import ImageImpl from './imageimpl'
import {Title, useAttachmentRedux, useCollapseIcon, Collapsed} from '../shared'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted: boolean
}

const Image2 = React.memo(function Image2(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p
  const {fileName, isCollapsed, isEditing, showTitle, openFullscreen} = useAttachmentRedux()
  const containerStyle = isHighlighted || isEditing ? styles.containerHighlighted : styles.container
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
        >
          <Kb.ClickableBox
            onClick={openFullscreen}
            onLongPress={toggleMessageMenu}
            style={styles.imageContainer}
          >
            <ImageImpl />
          </Kb.ClickableBox>
          {showTitle ? <Title /> : null}
        </Kb.Box2>
      </>
    )
  }, [filename, openFullscreen, toggleMessageMenu, showTitle])

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
    containerHighlighted: {
      alignSelf: 'center',
      backgroundColor: Styles.globalColors.yellowLight,
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
