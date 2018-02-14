// @flow
import * as Types from '../../constants/types/fs'
import {DropdownPopupMenu} from './popup'
import {connect, type TypedState} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    isTeamPath: boolean,
    items: Array<Types.PathBreadcrumbItem>,
    onOpenBreadcrumb: (path: string) => void,
  },
  {}
>

// $FlowIssue doesn't like routeProps here.
const mapStateToProps = (stateProps: TypedState, {routeProps}: OwnProps) => ({
  isTeamPath: routeProps.get('isTeamPath'),
  items: routeProps.get('items'),
  onOpenBreadcrumb: routeProps.get('onOpenBreadcrumb'),
})

const mapDispatchToProps = () => ({})

export default connect(mapStateToProps, mapDispatchToProps)(DropdownPopupMenu)
