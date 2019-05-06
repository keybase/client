// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {|
  path: Types.Path,
  refreshTag?: ?Types.RefreshTag,
|}

const mapDispatchToProps = (dispatch, {path, refreshTag}) => ({
  loadPathMetadata: () => dispatch(FsGen.createLoadPathMetadata({path, refreshTag})),
})

const mergeProps = (s, d, o) => ({
  path: o.path,
  ...d,
})

type Props = {|
  loadPathMetadata: () => void,
  path: Types.Path,
|}

class LoadPathMetadataWhenNeeded extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.loadPathMetadata()
  }
  componentDidUpdate(prevProps) {
    if (this.props.path !== prevProps.path) {
      this.props.loadPathMetadata()
    }
  }
  render() {
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  s => ({}),
  mapDispatchToProps,
  mergeProps,
  'LoadPathMetadataWhenNeeded'
)(LoadPathMetadataWhenNeeded)
