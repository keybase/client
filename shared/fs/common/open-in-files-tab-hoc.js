// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'

export type Props = {
  onOpenInFilesTab: Types.Path => void,
}

const mapDispatchToProps = dispatch => ({
  onOpenInFilesTab: (path: Types.Path) => dispatch(FsGen.createOpenPathInFilesTab({path})),
})

export default <T>(ComposedComponent: React.ComponentType<T & Props>) =>
  namedConnect<T, T & Props, React.ComponentType<T & Props>, _, _>(
    () => ({}),
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d}),
    'OpenInFilesTabHoc'
  )(ComposedComponent)
