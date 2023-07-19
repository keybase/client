import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

type OwnProps = {path: Types.Path}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))
  const sfmiEnabled = Constants.useState(s => s.sfmi.driverStatus.type === Types.DriverStatusType.Enabled)

  const _download = Constants.useState(s => s.dispatch.download)
  const download = () => {
    _download(path, 'download')
  }
  const openPathInSystemFileManagerDesktop = Constants.useState(
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
