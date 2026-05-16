import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import * as Kbfs from '../common'
import * as SimpleScreens from '../simple-screens'
import NormalPreview from './normal-preview'

type OwnProps = {
  initialLastModifiedTimestamp?: number
  path: T.FS.Path
}

const FilePreviewScreen = ({path, initialLastModifiedTimestamp}: OwnProps) => {
  return (
    <Kbfs.FsErrorProvider>
      <Kbfs.FsDataProvider initialPath={path} initialPathType={T.FS.PathType.File} initialLastModifiedTimestamp={initialLastModifiedTimestamp}>
        <FilePreviewScreenInner path={path} />
      </Kbfs.FsDataProvider>
    </Kbfs.FsErrorProvider>
  )
}

const FilePreviewScreenInner = ({path}: {path: T.FS.Path}) => {
  Kbfs.useFsScreenCoordinator(path)
  const {fileContext, onUrlError} = Kbfs.useFsFileContext(path)
  Kbfs.useFsOnlineStatus()
  Kbfs.useFsTlf(path)

  if (fileContext === FS.emptyFileContext) {
    return <SimpleScreens.Loading />
  }
  return <NormalPreview path={path} onUrlError={onUrlError} />
}

export default FilePreviewScreen
