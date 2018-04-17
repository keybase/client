// @flow
import * as GregorGen from '../../../../actions/gregor-gen'
import openURL from '../../../../util/open-url'
import {connect} from '../../../../util/container'
import Intro from '.'

type OwnProps = {teamname: string}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onHideSubteamsBanner: () =>
    dispatch(GregorGen.createInjectItem({body: 'true', category: 'sawSubteamsBanner'})),
  onReadMore: () => openURL('https://keybase.io/docs/teams/design'),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  onHideSubteamsBanner: dispatchProps.onHideSubteamsBanner,
  onReadMore: dispatchProps.onReadMore,
  teamname: ownProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Intro)
