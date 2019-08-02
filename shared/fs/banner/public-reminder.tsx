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
  const {lastPublicBannerClosedTlf, tlfName, clearLastPublicBannerClosedTlf} = props
  React.useEffect(() => {
    if (lastPublicBannerClosedTlf !== '' && lastPublicBannerClosedTlf !== tlfName) {
      clearLastPublicBannerClosedTlf()
    }
  }, [clearLastPublicBannerClosedTlf, tlfName, lastPublicBannerClosedTlf])
  return (
    (props.writable && props.public && props.lastPublicBannerClosedTlf !== props.tlfName && (
      <Kb.Banner color="yellow" onClose={props.onClose}>
        <Kb.BannerParagraph
          bannerColor="yellow"
          content={[
            'Everything you upload in here can be viewed by everyone at ',
            {onClick: () => openUrl(props.url), text: props.url},
            '.',
          ]}
        />
      </Kb.Banner>
    )) ||
    null
  )
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  lastPublicBannerClosedTlf: state.fs.lastPublicBannerClosedTlf,
  writable: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem).writable,
})

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
