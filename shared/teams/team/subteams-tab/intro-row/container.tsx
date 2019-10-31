import * as GregorGen from '../../../../actions/gregor-gen'
import openURL from '../../../../util/open-url'
import {connect} from '../../../../util/container'
import Intro from '.'

type OwnProps = {
  teamname: string
}

export default connect(
  state => ({shouldRender: !state.teams.sawSubteamsBanner}),
  dispatch => ({
    onHideSubteamsBanner: () =>
      dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawSubteamsBanner'})),
    onReadMore: () => openURL('https://keybase.io/docs/teams/design'),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    onHideSubteamsBanner: dispatchProps.onHideSubteamsBanner,
    onReadMore: dispatchProps.onReadMore,
    shouldRender: stateProps.shouldRender,
    teamname: ownProps.teamname,
  })
)(Intro)
