// @flow
import * as Types from '../constants/types/fs'
import {connect, type Dispatch} from '../util/container'
import {navigateAppend} from '../actions/route-tree'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state, ownProps: OwnProps) => ownProps

const mapDispatchToProps = (dispatch: Dispatch, {path}: OwnProps) => ({
  onOpen: () => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
})

const FolderHeaderBreadcrumbConnector = connect(mapStateToProps, mapDispatchToProps)
export {FolderHeaderBreadcrumbConnector}
