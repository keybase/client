import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import openUrl from '../../util/open-url'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'

type OwnProps = {
  path: Types.Path
}

type Props = {
  hidden: boolean
  onClose: () => void
  onLoad: () => void
  show: boolean
  url: string
}
const PublicBanner = (props: Props) => {
  if (props.show) {
    return (
      props.hidden && (
        <Kb.Banner
          color="yellow"
          text="Everything you upload in here can be viewed by everyone at "
          actions={[
            {
              onClick: () => openUrl(props.url),
              title: props.url + '.',
            },
          ]}
          onClose={props.onClose}
        />
      )
    )
  } else {
    props.onLoad()
    return null
  }
}

type StateProps = {_lastClosedTlf: string; _writable: boolean}
const mapStateToProps = (state, ownProps: OwnProps) => ({
  _lastClosedTlf: state.fs.lastPublicBannerClosedTlf,
  _writable: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem).writable,
})

type DispatchProps = {_onClose: (string) => () => void}
const mapDispatchToProps = dispatch => ({
  _onClose: tlf => () => dispatch(FsGen.createSetLastPublicBannerClosedTlf({tlf})),
})

const mergeProps = (s, d, o: OwnProps) => {
  const parsedPath = Constants.parsePath(o.path)
  switch (parsedPath.kind) {
    case Types.PathKind.GroupTlf:
    case Types.PathKind.InGroupTlf:
      return {
        hidden: s._lastClosedTlf !== parsedPath.tlfName,
        onClose: d._onClose(parsedPath.tlfName),
        onLoad: s._lastClosedTlf === '' ? () => {} : d._onClose(''),
        show: s._writable && parsedPath.tlfType === Types.TlfType.Public,
        url: `https://keybase.pub/${parsedPath.tlfName}`,
      }
    default:
      return {
        hidden: false,
        onClose: () => {},
        onLoad: s._lastClosedTlf === '' ? () => {} : d._onClose(''),
        show: false,
        url: '',
      }
  }
}

const ConnectedBanner = Container.namedConnect<OwnProps, StateProps, DispatchProps, Props, {}>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PublicReminder'
)(PublicBanner)
export default ConnectedBanner
