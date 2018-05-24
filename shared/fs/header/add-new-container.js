// @flow
import * as Types from '../../constants/types/fs'
import {connect, type Dispatch, type TypedState} from '../../util/container'
import AddNew from './add-new'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({})

const mergeProps = (stateProps, dispatchProps, {path, style}) => {
  const elems = Types.getPathElements(path)
  return {
    pathElementsNoKeybase: elems.slice(1),
    style,
    menuItems:
      elems.length <= 2
        ? []
        : [
            {
              onClick: () => {},
              icon: 'iconfont-upload',
              title: 'Upload file or folder',
            },
            {
              onClick: () => {},
              icon: 'iconfont-folder-new',
              title: 'New folder',
            },
          ],
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(AddNew)
