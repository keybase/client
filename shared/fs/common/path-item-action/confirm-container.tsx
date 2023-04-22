import type * as Types from '../../../constants/types/fs'
import * as React from 'react'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import Confirm, {type Props} from './confirm'
import type {FloatingMenuProps} from './types'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _pathItemActionMenu = Container.useSelector(state => state.fs.pathItemActionMenu)
  const size = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path).size)
  const dispatch = Container.useDispatch()
  const _confirm = React.useCallback(
    ({view, previousView}) => {
      dispatch(
        view === 'confirm-save-media' ? FsGen.createSaveMedia({path}) : FsGen.createShareNative({path})
      )
      dispatch(FsGen.createSetPathItemActionMenuView({view: previousView}))
    },
    [dispatch, path]
  )
  const props = {
    ...ownProps,
    action:
      _pathItemActionMenu.view === 'confirm-save-media'
        ? 'save-media'
        : ('send-to-other-app' as Props['action']),
    confirm: () => _confirm(_pathItemActionMenu),
    size,
  }
  return <Confirm {...props} />
}
