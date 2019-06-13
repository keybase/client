import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Title from './title'

// TODO destination-picker

type OwnProps = {
  path: Types.Path
  inDestinationPicker?: boolean | null
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {inDestinationPicker}: OwnProps) => ({
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

export default Container.namedConnect(
  () => ({}),
  mapDispatchToProps,
  (_, d, o: OwnProps) => ({
    path: o.path || Constants.defaultPath,
    ...d,
  }),
  'NavHeaderTitle'
)(Title)
