// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'
import flags from '../../util/feature-flags'

type OwnProps = {
  path: Types.Path,
  routePath?: ?I.List<string>,
}

const mapStateToProps = (state, ownProps) => ({
  isFile: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem).type === 'file',
})

const mapDispatchToProps = (dispatch, {path, routePath}: OwnProps) => ({
  onClickAttachment: () =>
    Constants.makeActionsForShowSendAttachmentToChat(path, routePath).forEach(action => dispatch(action)),
  onClickLink: () =>
    Constants.makeActionsForShowSendLinkToChat(path, routePath).forEach(action => dispatch(action)),
})

const YouSeeAButtonYouPushIt = Kb.OverlayParentHOC(props => {
  const parsedPath = Constants.parsePath(props.path)
  const link = Constants.canSendLinkToChat(parsedPath)
  const attachment = flags.sendAttachmentToChat && props.isFile
  if (!link && !attachment) {
    return null
  }
  return (
    <>
      <Kb.WithTooltip text="Send to chat">
        <Kb.Icon
          type="iconfont-open-browser"
          onClick={props.toggleShowingMenu}
          color={Styles.globalColors.black_50}
          hoverColor={Styles.globalColors.black}
          padding="tiny"
          ref={props.setAttachmentRef}
        />
      </Kb.WithTooltip>
      {props.showingMenu && (
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          position="bottom right"
          items={[
            ...(link ? [{onClick: props.onClickLink, title: 'Send link to chat'}] : []),
            ...(attachment ? [{onClick: props.onClickAttachment, title: 'Send attachment to chat'}] : []),
          ]}
        />
      )}
    </>
  )
})

export default (!isMobile
  ? namedConnect<OwnProps, _, _, _, _>(
      mapStateToProps,
      mapDispatchToProps,
      (s, d, o) => ({...o, ...s, ...d}),
      'SendInAppAction'
    )(YouSeeAButtonYouPushIt)
  : () => null)
