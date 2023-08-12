import * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import DefaultView from './default-view'

type OwnProps = {path: Types.Path}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const sfmiEnabled = C.useFSState(s => s.sfmi.driverStatus.type === Types.DriverStatusType.Enabled)

  const _download = C.useFSState(s => s.dispatch.download)
  const download = () => {
    _download(path, 'download')
  }
  const openPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )
  const showInSystemFileManager = () => {
    openPathInSystemFileManagerDesktop?.(path)
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
