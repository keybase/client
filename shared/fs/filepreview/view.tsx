import * as Chat from '@/constants/chat'
import * as React from 'react'
import * as T from '@/constants/types'
import DefaultView from './default-view'
import TextView from './text-view'
import AVView from './av-view'
import PdfView from './pdf-view'
import * as Kb from '@/common-adapters'
import * as FS from '@/constants/fs'
import {useFsFileContext} from '../common'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {isAndroidPreP} from '@/constants/platform'

type Props = {
  path: T.FS.Path
  onUrlError: (err: string) => void
}

const textViewUpperLimit = 10 * 1024 * 1024 // 10MB

const FilePreviewView = (p: Props) => {
  const styles = useStyles()
  return (
    <Kb.BoxGrow style={styles.container}>
      <FilePreviewViewContent {...p} />
    </Kb.BoxGrow>
  )
}

const FilePreviewViewContent = ({path, onUrlError}: Props) => {
  const styles = useStyles()
  const {fileContext, pathItem} = useFsFileContext(path)
  const [loadedLastModifiedTimestamp, setLoadedLastModifiedTimestamp] = React.useState(
    pathItem.lastModifiedTimestamp
  )
  const reload = () => setLoadedLastModifiedTimestamp(pathItem.lastModifiedTimestamp)
  const tooLargeForText = pathItem.type === T.FS.PathType.File && pathItem.size > textViewUpperLimit

  if (pathItem.type === T.FS.PathType.Symlink) {
    return <DefaultView path={path} />
  }

  if (pathItem.type !== T.FS.PathType.File) {
    return <Kb.Text type="BodySmallError">{`This shouldn't happen type=${pathItem.type}`}</Kb.Text>
  }

  if (fileContext === FS.emptyFileContext) {
    // We are still loading fileContext which is needed to determine which
    // component to use.
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Text type="BodySmall">Loading ...</Kb.Text>
      </Kb.Box2>
    )
  }

  const reloadBanner = loadedLastModifiedTimestamp !== pathItem.lastModifiedTimestamp && (
    <Kb.Box2 direction="vertical" fullWidth={true} relative={true} style={styles.bannerContainer}>
      <Kb.Banner color="blue" style={styles.banner}>
        <Kb.BannerParagraph
          bannerColor="blue"
          content={['The content of this file has updated. ', {onClick: reload, text: 'Reload'}, '.']}
        />
      </Kb.Banner>
    </Kb.Box2>
  )

  // Electron caches <img> aggressively and doesn't really probe server to
  // find out if resource has updated. So embed timestamp into URL to force a
  // reload when needed.
  const url = fileContext.url + `&unused_field_ts=${loadedLastModifiedTimestamp}`
  const viewType: T.RPCGen.GUIViewType = fileContext.viewType
  switch (viewType) {
    case T.RPCGen.GUIViewType.default: {
      // mobile client only supports heic now
      if (isIOS && Chat.isPathHEIC(pathItem.name)) {
        return (
          <>
            {reloadBanner}
            <Kb.ZoomableImage src={url} style={styles.zoomableBox} boxCacheKey="fsdef" />
          </>
        )
      }
      return <DefaultView path={path} />
    }
    case T.RPCGen.GUIViewType.text:
      return tooLargeForText ? (
        <DefaultView path={path} />
      ) : (
        <>
          {reloadBanner}
          <TextView url={url} onUrlError={onUrlError} />
        </>
      )
    case T.RPCGen.GUIViewType.image: {
      // no webp
      if (fileContext.contentType === 'image/webp') {
        return <DefaultView path={path} />
      }
      // Chromium has no HEIC decoder, nor does Android before 9
      if (heifTypes.has(fileContext.contentType) && (!isMobile || isAndroidPreP)) {
        return <DefaultView path={path} note={cantPreviewImage} />
      }

      return (
        <>
          {reloadBanner}
          <ImagePreview key={url} path={path} url={url} onUrlError={onUrlError} />
        </>
      )
    }
    case T.RPCGen.GUIViewType.audio: // fallthrough
    case T.RPCGen.GUIViewType.video:
      return (
        <>
          {reloadBanner}
          <AVView url={url} onUrlError={onUrlError} />
        </>
      )
    case T.RPCGen.GUIViewType.pdf:
      return !isAndroid ? (
        <>
          {reloadBanner}
          <PdfView url={url} onUrlError={onUrlError} />
        </>
      ) : (
        <DefaultView path={path} />
      )
    default:
      return <Kb.Text type="BodySmallError">{"This shouldn't happen"}</Kb.Text>
  }
}

const heifTypes = new Set(['image/heic', 'image/heif'])
const cantPreviewImage = "Can't preview image"

// keyed by url so a reload or a fresh url retries an image that failed to draw
const ImagePreview = ({path, url, onUrlError}: Props & {url: string}) => {
  const styles = useStyles()
  // desktop only: mobile images retry on their own and don't report errors
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return <DefaultView path={path} note={cantPreviewImage} />
  }
  return (
    <Kb.ZoomableImage
      src={url}
      style={styles.zoomableBox}
      boxCacheKey="fsimg"
      testID={TestIDs.FILES_IMAGE_PREVIEW}
      onError={() => {
        // the url can be stale (service restarted); refetching it is a no-op for a repeated error
        onUrlError('image failed to load')
        setFailed(true)
      }}
    />
  )
}

export default FilePreviewView

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      banner: {
        opacity: 0.85,
        position: 'absolute',
        top: 0,
        width: '100%',
      },
      bannerContainer: {
        zIndex: 200, // needed for mobile
      },
      container: {
        width: '100%',
      },
      zoomableBox: {
        backgroundColor: theme.blackOrBlack,
        height: '100%',
        position: 'relative',
        width: '100%',
      },
    }) as const
)
