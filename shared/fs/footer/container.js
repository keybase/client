// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Footer, {type FooterProps} from './footer'

const mapStateToProps = (state: TypedState) => ({
  _downloads: state.fs.downloads,
  showUploads: !!(state.fs.uploads.syncingPaths.size || state.fs.uploads.writingToJournal.size),
})

const mergeProps = ({_downloads, showUploads}, dispatchProps, ownProps) =>
  ({
    downloadKeys: Array.from(_downloads.filter(download => download.meta.intent === 'none'))
      .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
      .map(([key, download]) => key),
    showUploads,
  }: FooterProps)

export default compose(connect(mapStateToProps, undefined, mergeProps), setDisplayName('ConnectedFooter'))(
  Footer
)
