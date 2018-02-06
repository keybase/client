// @flow
import * as Types from '../constants/types/fs'
import {connect, type Dispatch} from '../util/container'
import {navigateAppend} from '../actions/route-tree'

const mapStateToProps = (state, ownProps) => ownProps

const mapDispatchToProps = (dispatch: Dispatch, ownProps) => ({
  onOpen: (path: Types.Path) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
  ...ownProps,
})

const FolderHeaderBreadcrumbConnector = connect(mapStateToProps, mapDispatchToProps)
export {FolderHeaderBreadcrumbConnector}
