import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import DefaultView from './default-view-container'
import TextView from './text-view'
import AVView from './av-view'
import PdfView from './pdf-view'
import * as Kb from '@/common-adapters'

type Props = {
  path: T.FS.Path
  onUrlError: (err: string) => void
}

const textViewUpperLimit = 10 * 1024 * 1024 // 10MB

const FilePreviewView = (p: Props) => {
  return (
    <Kb.BoxGrow style={styles.container}>
      <FilePreviewViewContent {...p} />
    </Kb.BoxGrow>
  )
}

const FilePreviewViewContent = ({path, onUrlError}: Props) => {
  const pathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, path))
  const [loadedLastModifiedTimestamp, setLoadedLastModifiedTimestamp] = React.useState(
    pathItem.lastModifiedTimestamp
  )
  const reload = () => setLoadedLastModifiedTimestamp(pathItem.lastModifiedTimestamp)
  const tooLargeForText = pathItem.type === T.FS.PathType.File && pathItem.size > textViewUpperLimit

  const fileContext = C.useFSState(s => s.fileContext.get(path) || C.FS.emptyFileContext)

  if (pathItem.type === T.FS.PathType.Symlink) {
    return <DefaultView path={path} />
  }

  if (pathItem.type !== T.FS.PathType.File) {
    return <Kb.Text type="BodySmallError">This shouldn't happen type={pathItem.type}</Kb.Text>
  }

  if (fileContext === C.FS.emptyFileContext) {
    // We are still loading fileContext which is needed to determine which
    // component to use.
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Text type="BodySmall">Loading ...</Kb.Text>
      </Kb.Box2>
    )
  }

  const reloadBanner = loadedLastModifiedTimestamp !== pathItem.lastModifiedTimestamp && (
    <Kb.Box style={styles.bannerContainer}>
      <Kb.Banner color="blue" style={styles.banner}>
        <Kb.BannerParagraph
          bannerColor="blue"
          content={['The content of this file has updated. ', {onClick: reload, text: 'Reload'}, '.']}
        />
      </Kb.Banner>
    </Kb.Box>
  )

  // Electron caches <img> aggressively and doesn't really probe server to
  // find out if resource has updated. So embed timestamp into URL to force a
  // reload when needed.
  const url = fileContext.url + `&unused_field_ts=${loadedLastModifiedTimestamp}`
  switch (fileContext.viewType) {
    case T.RPCGen.GUIViewType.default: {
      // mobile client only supports heic now
      if (C.isIOS && C.Chat.isPathHEIC(pathItem.name)) {
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

      return (
        <>
          {reloadBanner}
          <Kb.ZoomableImage src={url} style={styles.zoomableBox} boxCacheKey="fsimg" />
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
      return !C.isAndroid ? (
        <>
          {reloadBanner}
          <PdfView url={url} onUrlError={onUrlError} />
        </>
      ) : (
        <DefaultView path={path} />
      )
    default:
      return <Kb.Text type="BodySmallError">This shouldn't happen</Kb.Text>
  }
}

export default FilePreviewView

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        opacity: 0.85,
        position: 'absolute',
        top: 0,
        width: '100%',
      },
      bannerContainer: {
        position: 'relative',
        width: '100%',
        zIndex: 200, // needed for mobile
      },
      container: {
        width: '100%',
      },
      zoomableBox: {
        backgroundColor: Kb.Styles.globalColors.blackOrBlack,
        height: '100%',
        position: 'relative',
        width: '100%',
      },
    }) as const
)
