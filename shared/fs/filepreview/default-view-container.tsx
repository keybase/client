import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

type OwnProps = {path: Types.Path}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))
  const sfmiEnabled = Container.useSelector(
    state => state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled
  )
  const dispatch = Container.useDispatch()
  const download = () => {
    dispatch(FsGen.createDownload({path}))
  }
  const showInSystemFileManager = () => {
    dispatch(FsGen.createOpenPathInSystemFileManager({path}))
  }
  const props = {
    download,
    path,
    pathItem,
    sfmiEnabled,
    showInSystemFileManager,
  }
  return <DefaultView {...props} />
}
