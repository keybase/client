import * as React from 'react'
import {Box, Icon, ProgressIndicator, OverlayParentHOC, OverlayParentProps} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../styles'
import * as Types from '../../../constants/types/teams'
import TeamMenu from '../menu-container'

type Props = {
  onChat: () => void
  canChat: boolean
  loading: boolean
  teamID: Types.TeamID
}

const fontSize = isMobile ? 20 : 16

const _CustomComponent = (props: Props & OverlayParentProps) => (
  <Box style={styles.container}>
    {isMobile && props.loading && <ProgressIndicator style={styles.progressIndicator} />}
    {props.canChat && (
      <Icon onClick={props.onChat} fontSize={fontSize} style={styles.icon} type="iconfont-chat" />
    )}
    <Icon
      ref={props.setAttachmentRef}
      onClick={props.toggleShowingMenu}
      type="iconfont-ellipsis"
      fontSize={fontSize}
      style={styles.icon}
    />
    <TeamMenu
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamID={props.teamID}
      visible={props.showingMenu}
    />
  </Box>
)

const styles = styleSheetCreate(() => ({
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
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
}))

const CustomComponent = OverlayParentHOC(_CustomComponent)
export default CustomComponent
