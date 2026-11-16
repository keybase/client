import type * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import * as Kbfs from '../common'
import * as SimpleScreens from '../simple-screens'
import NormalPreview from './normal-preview'
import {MainBanner} from '../nav-header'
import {IosHeaderMenu} from '../nav-header/ios-header'
import {filePreviewSeed, type FilePreviewParams} from '../route-seeds'

const FilePreviewScreen = (params: FilePreviewParams) => {
  const {path} = params
  return (
    <Kbfs.FsErrorProvider>
      <Kbfs.FsDataProvider {...filePreviewSeed(path, params)}>
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

  // On mobile the native/custom header no longer hosts the banner, so it lives
  // at the top of the screen body instead.
  return (
    <>
      {isIOS && <IosHeaderMenu path={path} mayUpload={false} />}
      {isMobile && <MainBanner />}
      {fileContext === FS.emptyFileContext ? (
        <SimpleScreens.Loading />
      ) : (
        <NormalPreview path={path} onUrlError={onUrlError} />
      )}
    </>
  )
}

export default FilePreviewScreen
