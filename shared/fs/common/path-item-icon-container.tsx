import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import PathItemIcon, {Size} from './path-item-icon'

export type OwnProps = {
  badge?: Types.PathItemBadge | null
  path: Types.Path
  size: Size
  style?: Styles.StylesCrossPlatform
}

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  type: stateProps._pathItem.type,
  username: stateProps.username,
})

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'PathItemIcon')(PathItemIcon)
