// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {isMobile} from '../../constants/platform'
import * as FsGen from '../../actions/fs-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {namedConnect} from '../../util/container'

type OwnProps = {
  path: Types.Path,
  routePath?: ?I.List<string>,
  sendIconClassName: string,
}

const mapDispatchToProps = (dispatch, {path, routePath}: OwnProps) => ({
  onClick: () => dispatch(FsGen.createShowSendLinkToChat({path, routePath})),
})

const YouSeeAButtonYouPushIt = ({onClick, sendIconClassName}) => (
  <Kb.Icon
    type="iconfont-open-browser"
    onClick={onClick}
    className={sendIconClassName}
    style={Kb.iconCastPlatformStyles(styles.icon)}
  />
)
const styles = Styles.styleSheetCreate({
  icon: {
    padding: Styles.globalMargins.tiny,
  },
})

export default (isMobile
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(
      () => ({}),
      mapDispatchToProps,
      (s, d, o) => ({...o, ...s, ...d}),
      'SendInAppAction'
    )(YouSeeAButtonYouPushIt))
