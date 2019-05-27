import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _loadingPaths: state.fs.loadingPaths,
})

const emptySet = I.Set()

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  loading: stateProps._loadingPaths.get(path, emptySet).size > 0,
})

const Loading = props => props.loading && <Kb.ProgressIndicator type="Small" />

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'TopBarLoading')(Loading)
