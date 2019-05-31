import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import AVView from './av-view'
import * as Kb from '../../common-adapters'

type Props = {
  lastModifiedTimestamp: number
  mime?: Types.Mime | null
  onLoadingStateChange: (arg0: boolean) => void
  path: Types.Path
  type: Types.PathType
  routePath: I.List<string>
  url: string
}

type State = {
  loadedLastModifiedTimestamp: number
}

export default class FilePreviewView extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      loadedLastModifiedTimestamp: this.props.lastModifiedTimestamp,
    }
  }
  _reload = () => {
    this.setState({
      loadedLastModifiedTimestamp: this.props.lastModifiedTimestamp,
    })
  }

  componentDidUpdate(prevProps: Props) {
    // If path changes we need to reset loadedLastModifiedTimestamp. This
    // probalby never happens since we don't navigate from one file to another
    // directly (i.e. without unmounting) in file-preview, but just in case.
    this.props.path !== prevProps.path && this._reload()
  }

  render() {
    if (this.props.type === Types.PathType.Symlink) {
      return <DefaultView path={this.props.path} routePath={this.props.routePath} />
    }

    if (this.props.type !== Types.PathType.File) {
      return <Kb.Text type="BodySmallError">This shouldn't happen type={this.props.type}</Kb.Text>
    }

    if (!this.props.mime) {
      // We are still loading this.props.pathItem.mime which is needed to
      // determine which component to use.
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.Text type="BodySmall">Loading ...</Kb.Text>
        </Kb.Box2>
      )
    }

    const reloadBanner = this.state.loadedLastModifiedTimestamp !== this.props.lastModifiedTimestamp && (
      <Kb.Box style={styles.bannerContainer}>
        <Kb.Banner
          color="blue"
          text="The content of this file has updated."
          actions={[{onClick: this._reload, title: 'Reload'}]}
          style={styles.banner}
        />
      </Kb.Box>
    )

    // Electron caches <img> aggressively and doesn't really probe server to
    // find out if resource has updated. So embed timestamp into URL to force
    // a reload when needed.
    const url = this.props.url + `&unused_field_ts=${this.state.loadedLastModifiedTimestamp}`

    switch (Constants.viewTypeFromMimeType(this.props.mime)) {
      case Types.FileViewType.Default:
        return <DefaultView path={this.props.path} routePath={this.props.routePath} />
      case Types.FileViewType.Text:
        return (
          <>
            {reloadBanner}
            <TextView url={url} onLoadingStateChange={this.props.onLoadingStateChange} />
          </>
        )
      case Types.FileViewType.Image:
        return (
          <>
            {reloadBanner}
            <ImageView
              url={url}
              routePath={this.props.routePath}
              onLoadingStateChange={this.props.onLoadingStateChange}
            />
          </>
        )
      case Types.FileViewType.Av:
        return (
          <>
            {reloadBanner}
            <AVView url={url} onLoadingStateChange={this.props.onLoadingStateChange} />
          </>
        )
      case Types.FileViewType.Pdf:
        // Security risks to links in PDF viewing. See DESKTOP-6888.
        return <DefaultView path={this.props.path} routePath={this.props.routePath} />
      default:
        return <Kb.Text type="BodySmallError">This shouldn't happen</Kb.Text>
    }
  }
}

const styles = Styles.styleSheetCreate({
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
})
