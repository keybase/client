import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import PathItemIcon, {Size} from './path-item-icon'

export type OwnProps = {
  badge?: Types.PathItemBadge | null
  path: Types.Path
  showTlfTypeIcon?: boolean
  size: Size
  style?: Styles.StylesCrossPlatform
}

export default namedConnect(
  (state, {path}: OwnProps) => ({
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
    username: state.config.username,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    ...ownProps,
    type: stateProps._pathItem.type,
    username: stateProps.username,
  }),
  'PathItemIcon'
)(PathItemIcon)
