// @flow
import * as Types from '../../constants/types/fs'
import {compose, setDisplayName, connect, type Dispatch, type TypedState} from '../../util/container'
import AddNew from './add-new'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({})

const mergeProps = (stateProps, dispatchProps, {path, style}) => {
  const pathElements = Types.getPathElements(path)
  return {
    pathElements,
    style,
    menuItems:
      pathElements.length <= 2
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedAddNew')
)(AddNew)
