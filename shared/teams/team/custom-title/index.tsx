import * as React from 'react'
import {
  iconCastPlatformStyles,
  Box,
  Icon,
  ProgressIndicator,
  OverlayParentHOC,
  OverlayParentProps,
} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../styles'
import TeamMenu from '../menu-container'

type Props = {
  onChat: () => void
  canChat: boolean
  loading: boolean
  teamname: string
}

const fontSize = isMobile ? 20 : 16

const _CustomComponent = (props: Props & OverlayParentProps) => (
  <Box style={styles.container}>
    {isMobile && props.loading && <ProgressIndicator style={styles.progressIndicator} />}
    {props.canChat && (
      <Icon
        onClick={props.onChat}
        fontSize={fontSize}
        style={iconCastPlatformStyles(styles.icon)}
        type="iconfont-chat"
      />
    )}
    <Icon
      ref={props.setAttachmentRef}
      onClick={props.toggleShowingMenu}
      type="iconfont-ellipsis"
      fontSize={fontSize}
      style={iconCastPlatformStyles(styles.icon)}
    />
    <TeamMenu
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamname={props.teamname}
      visible={props.showingMenu}
    />
  </Box>
)

const styles = styleSheetCreate({
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  icon: {
    marginRight: globalMargins.tiny,
    padding: globalMargins.tiny,
  },
  progressIndicator: {
    height: 17,
    marginRight: globalMargins.tiny,
    width: 17,
  },
})

const CustomComponent = OverlayParentHOC(_CustomComponent)
export default CustomComponent
