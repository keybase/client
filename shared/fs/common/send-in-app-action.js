// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {
  path: Types.Path,
  routePath?: ?I.List<string>,
  sendIconClassName: string,
  attach?: ?boolean, // TODO: get rid of this and do the menu thing as designed
}

const mapDispatchToProps = (dispatch, {path, routePath, attach}: OwnProps) => ({
  onClickAttachment: () => dispatch(FsGen.createShowSendAttachmentToChat({path, routePath})),
  onClickLink: () => dispatch(FsGen.createShowSendLinkToChat({path, routePath})),
})

const YouSeeAButtonYouPushIt = Kb.OverlayParentHOC(
  props =>
    Constants.canSendLinkToChat(Constants.parsePath(props.path)) && (
      <>
        <Kb.WithTooltip text="Send link to chat">
          <Kb.Icon
            type="iconfont-open-browser"
            onClick={props.toggleShowingMenu}
            ref={props.setAttachmentRef}
            className={props.sendIconClassName}
            style={Kb.iconCastPlatformStyles(styles.icon)}
          />
        </Kb.WithTooltip>
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          position="bottom left"
          items={[
            {onClick: props.onClickLink, title: 'Send link to chat'},
            ...(Types.getPathLevel(props.path) > 3
              ? [{onClick: props.onClickAttachment, title: 'Send attachment to chat'}]
              : []),
          ]}
        />
      </>
    )
)

const styles = Styles.styleSheetCreate({
  icon: {
    padding: Styles.globalMargins.tiny,
  },
})

export default (!isMobile
  ? namedConnect<OwnProps, _, _, _, _>(
      () => ({}),
      mapDispatchToProps,
      (s, d, o) => ({...o, ...s, ...d}),
      'SendInAppAction'
    )(YouSeeAButtonYouPushIt)
  : () => null)
