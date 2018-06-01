// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Editing from './editing'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({})

const mergeProps = (stateProps, dispatchProps) => ({
  name: stateProps.pathItem.name,
  status: 'editing',
  isCreate: true,
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(stateProps.path),
    stateProps.pathItem.type,
    stateProps._username
  ),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('EditingRow')
)(Editing)
