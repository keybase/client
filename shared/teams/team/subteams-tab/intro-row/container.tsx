import * as GregorGen from '../../../../actions/gregor-gen'
import openURL from '../../../../util/open-url'
import {connect} from '../../../../util/container'
import Intro from '.'

type OwnProps = {
  teamname: string
}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onHideSubteamsBanner: () =>
    dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawSubteamsBanner'})),
  onReadMore: () => openURL('https://keybase.io/docs/teams/design'),
})

const mergeProps = (_, dispatchProps, ownProps: OwnProps) => ({
  onHideSubteamsBanner: dispatchProps.onHideSubteamsBanner,
  onReadMore: dispatchProps.onReadMore,
  teamname: ownProps.teamname,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Intro)
