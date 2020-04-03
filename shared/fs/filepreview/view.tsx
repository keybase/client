import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import DefaultView from './default-view-container'
import ImageView from './image-view'
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

const FilePreviewView = ({path, onUrlError}: Props) => {
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const [loadedLastModifiedTimestamp, setLoadedLastModifiedTimestamp] = React.useState(
    pathItem.lastModifiedTimestamp
  )
  const reload = () => setLoadedLastModifiedTimestamp(pathItem.lastModifiedTimestamp)
  const tooLargeForText = pathItem.type === Types.PathType.File && pathItem.size > textViewUpperLimit

  const fileContext = Container.useSelector(
    state => state.fs.fileContext.get(path) || Constants.emptyFileContext
  )

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
          <ImageView url={url} onUrlError={onUrlError} />
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
      return Platform.isIOS ? (
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
    } as const)
)
