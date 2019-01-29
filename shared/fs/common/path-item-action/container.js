// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import PathItemAction from '.'

type OwnProps = {|
  actionIconClassName?: string,
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
  path: Types.Path,
|}

const mapDispatchToProps = dispatch => ({
  onHidden: () => {
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'path-item-action-popup'}))
    dispatch(FsGen.createSetPathItemActionMenuView({view: Constants.makePathItemActionMenuRootView()}))
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PathItemAction'
)(PathItemAction)
