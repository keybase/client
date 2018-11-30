// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'

const mapDispatchToProps = dispatch => ({
  onOpenInFilesTab: (path: Types.Path) => dispatch(FsGen.createOpenPathInFilesTab({path})),
})

export default (ComposedComponent: React.ComponentType<any>) =>
  namedConnect<any, _, _, _, _>(
    () => ({}),
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d}),
    'OpenInFilesTabHoc'
  )(ComposedComponent)
