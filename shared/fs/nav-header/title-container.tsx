import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Title from './title'

// TODO destination-picker

type OwnProps = {
  path: Types.Path
  inDestinationPicker?: boolean | null
}

const mapStateToProps = state => ({})

const mapDispatchToProps = (dispatch, {inDestinationPicker}) => ({
  onOpenPath: inDestinationPicker
    ? (path: Types.Path) =>
        Constants.makeActionsForDestinationPickerOpen(0, path).forEach(action => dispatch(action))
    : (path: Types.Path) =>
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {path}, selected: 'main'}],
          })
        ),
})

const mergeProps = (s, d, o) => ({
  path: o.path || Constants.defaultPath,
  ...d,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'NavHeaderTitle')(Title)
