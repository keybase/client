import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import DefaultView from './default-view-container'
import TextView from './text-view'
import AVView from './av-view'
import PdfView from './pdf-view'
import * as Kb from '../../common-adapters'
import * as Platform from '../../constants/platform'

type Props = {
  path: Types.Path
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
  const pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))
  const [loadedLastModifiedTimestamp, setLoadedLastModifiedTimestamp] = React.useState(
    pathItem.lastModifiedTimestamp
  )
  const reload = () => setLoadedLastModifiedTimestamp(pathItem.lastModifiedTimestamp)
  const tooLargeForText = pathItem.type === Types.PathType.File && pathItem.size > textViewUpperLimit

  const fileContext = Constants.useState(s => s.fileContext.get(path) || Constants.emptyFileContext)

  if (pathItem.type === Types.PathType.Symlink) {
    return <DefaultView path={path} />
  }

  if (pathItem.type !== Types.PathType.File) {
    return <Kb.Text type="BodySmallError">This shouldn't happen type={pathItem.type}</Kb.Text>
  }

  if (fileContext === Constants.emptyFileContext) {
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
    case RPCTypes.GUIViewType.default:
      return <DefaultView path={path} />
    case RPCTypes.GUIViewType.text:
      return tooLargeForText ? (
        <DefaultView path={path} />
      ) : (
        <>
          {reloadBanner}
          <TextView url={url} onUrlError={onUrlError} />
        </>
      )
    case RPCTypes.GUIViewType.image:
      return (
        <>
          {reloadBanner}
          <Kb.ZoomableImage src={url} style={styles.zoomableBox} />
        </>
      )
    case RPCTypes.GUIViewType.audio:
    case RPCTypes.GUIViewType.video:
      return (
        <>
          {reloadBanner}
          <AVView url={url} onUrlError={onUrlError} />
        </>
      )
    case RPCTypes.GUIViewType.pdf:
      return !Platform.isAndroid ? (
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

const styles = Styles.styleSheetCreate(
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
        backgroundColor: Styles.globalColors.blackOrBlack,
        height: '100%',
        position: 'relative',
        width: '100%',
      },
    } as const)
)
