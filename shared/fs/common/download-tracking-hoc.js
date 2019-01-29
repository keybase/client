// @flow
import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'

type OwnProps = {|
  trackingPath: Types.Path,
  trackingIntent: Types.DownloadIntent,
  onFinish?: () => void,
  cancelOnUnmount?: boolean,
|}

type TriggerOnFinishProps = {|
  status: 'absent' | 'downloading' | 'finished',
  onFinish?: () => void,
  onUnmount?: (() => void) | false,
|}

type ProvidedProps = {|
  downloading: boolean,
|}

type ComposedComponentProps<PassthroughProps> = {|
  ...$Exact<PassthroughProps>,
  ...$Exact<ProvidedProps>,
|}

type DownloadTrakingHocProps<PassthroughProps> = {|
  ...$Exact<PassthroughProps>,
  ...$Exact<TriggerOnFinishProps>,
|}

type ConnectorProps<PassthroughProps> = {|
  ...$Exact<PassthroughProps>,
  ...$Exact<OwnProps>,
|}

const mapStateToProps = state => ({
  _downloads: state.fs.downloads,
})

const mapDispatchToProps = dispatch => ({
  _cancel: (key: string) => dispatch(FsGen.createCancelDownload({key})),
})

const mergeProps = ({_downloads}, {_cancel}, ownProps: OwnProps) => {
  const {trackingPath, trackingIntent, onFinish, cancelOnUnmount, ...rest} = ownProps
  // TODO: it's unfortunate that we have to iterate there; should probably
  // structure `downloads` differently in the store. But it's usually pretty
  // small so maybe it's not really necessary.
  const [key, download] = _downloads.findEntry(download =>
    // We are filtering on only pending downloads becasue when a download is
    // done, we are already done with processing the intents as well, and it'd
    // be irrelevant to the menu being displayed.
    Constants.isPendingDownload(download, trackingPath, trackingIntent)
  ) || ['', undefined]
  return {
    ...rest,
    onFinish,
    onUnmount: cancelOnUnmount && !!key.length && (() => _cancel(key)),
    status: download ? (download.state.completePortion === 1 ? 'finished' : 'downloading') : 'absent',
  }
}

const DownloadTrackingHoc = <PassthroughProps: {}>(
  ComposedComponent: React.ComponentType<ComposedComponentProps<PassthroughProps>>
) =>
  class TriggerOnFinish extends React.PureComponent<DownloadTrakingHocProps<PassthroughProps>> {
    componentDidMount() {
      this.props.status === 'finished' && this.props.onFinish && this.props.onFinish()
    }
    componentDidUpdate() {
      this.props.status === 'finished' && this.props.onFinish && this.props.onFinish()
    }
    componentWillUnmount() {
      this.props.onUnmount && this.props.onUnmount()
    }
    render() {
      const {status, onFinish, onUnmount, ...rest} = this.props
      return <ComposedComponent downloading={this.props.status === 'downloading'} {...rest} />
    }
  }

export default function<PassthroughProps: {}>(
  ComposedComponent: React.ComponentType<ComposedComponentProps<PassthroughProps>>
): React.ComponentType<ConnectorProps<PassthroughProps>> {
  return namedConnect<ConnectorProps<PassthroughProps>, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    'ConnectedDownloadTrackingHoc'
  )(DownloadTrackingHoc<PassthroughProps>(ComposedComponent))
}
