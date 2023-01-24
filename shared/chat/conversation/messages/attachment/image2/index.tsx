import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import ImageImpl from './imageimpl'
import {useCollapseLabel, Title, useAttachmentRedux} from '../shared'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted: boolean
}

const Image2 = React.memo(function Image2(p: Props) {
  const {isHighlighted, toggleMessageMenu} = p
  const {isCollapsed, isEditing, showTitle, openFullscreen} = useAttachmentRedux()
  const containerStyle = isHighlighted || isEditing ? styles.containerHighlighted : styles.container
  const collapseLabel = useCollapseLabel()

  const content = React.useMemo(() => {
    return (
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
    )
  }, [openFullscreen, toggleMessageMenu, showTitle])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={containerStyle} alignItems="flex-start">
      {collapseLabel}
      {isCollapsed ? null : content}
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
      backgroundColor: Styles.isAndroid ? undefined : Styles.globalColors.black_05_on_white,
      borderRadius: Styles.borderRadius,
      maxWidth: Styles.isMobile ? '100%' : 330,
      padding: Styles.globalMargins.tiny,
      position: 'relative',
    },
    imageContainer: {alignSelf: 'center'},
  } as const
})

export default Image2
