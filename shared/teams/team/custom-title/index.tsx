import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/teams'
import TeamMenu from '../menu-container'

type Props = {
  onChat: () => void
  canChat: boolean
  loading: boolean
  teamID: Types.TeamID
}

const fontSize = Styles.isMobile ? 20 : 16

const _CustomComponent = (props: Props & Kb.OverlayParentProps) => (
  <Kb.Box style={styles.container}>
    {Styles.isMobile && props.loading && <Kb.ProgressIndicator style={styles.progressIndicator} />}
    {props.canChat && (
      <Kb.Icon
        onClick={props.onChat}
        fontSize={fontSize}
        style={styles.icon}
        type={Kb.Icon.makeFastType(Kb.IconType.iconfont_chat)}
      />
    )}
    <Kb.Icon
      ref={props.setAttachmentRef}
      onClick={props.toggleShowingMenu}
      type={Kb.Icon.makeFastType(Kb.IconType.iconfont_ellipsis)}
      fontSize={fontSize}
      style={styles.icon}
    />
    <TeamMenu
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      teamID={props.teamID}
      visible={props.showingMenu}
    />
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  icon: {
    marginRight: Styles.globalMargins.tiny,
    padding: Styles.globalMargins.tiny,
  },
  progressIndicator: {
    height: 17,
    marginRight: Styles.globalMargins.tiny,
    width: 17,
  },
}))

const CustomComponent = Kb.OverlayParentHOC(_CustomComponent)
export default CustomComponent
