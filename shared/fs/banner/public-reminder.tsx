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
  clearLastPublicBannerClosedTlf: () => void
  lastPublicBannerClosedTlf: string
  onClose: () => void
  public: boolean
  tlfName: string
  url: string
  writable: boolean
}
const PublicBanner = (props: Props) => {
  React.useEffect(() => {
    if (props.lastPublicBannerClosedTlf !== '' && props.lastPublicBannerClosedTlf !== props.tlfName) {
      props.clearLastPublicBannerClosedTlf()
    }
  }, [props.tlfName, props.lastPublicBannerClosedTlf])
  return (
    (props.writable && props.public && props.lastPublicBannerClosedTlf !== props.tlfName && (
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
    )) ||
    null
  )
}

type StateProps = {lastPublicBannerClosedTlf: string; writable: boolean}
const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  lastPublicBannerClosedTlf: state.fs.lastPublicBannerClosedTlf,
  writable: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem).writable,
})

type DispatchProps = {setLastPublicBannerClosedTlf: (string) => () => void}
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  setLastPublicBannerClosedTlf: tlf => () => dispatch(FsGen.createSetLastPublicBannerClosedTlf({tlf})),
})

const ConnectedBanner = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => {
    const parsedPath = Constants.parsePath(o.path)
    switch (parsedPath.kind) {
      case Types.PathKind.GroupTlf:
      case Types.PathKind.InGroupTlf:
        return {
          ...s,
          clearLastPublicBannerClosedTlf: d.setLastPublicBannerClosedTlf(''),
          onClose: d.setLastPublicBannerClosedTlf(parsedPath.tlfName),
          public: parsedPath.tlfType === Types.TlfType.Public,
          tlfName: parsedPath.tlfName,
          url: `https://keybase.pub/${parsedPath.tlfName}`,
        }
      default:
        return {
          ...s,
          clearLastPublicBannerClosedTlf: d.setLastPublicBannerClosedTlf(''),
          onClose: () => {},
          public: false,
          tlfName: '',
          url: '',
        }
    }
  },
  'PublicReminder'
)(PublicBanner)
export default ConnectedBanner
