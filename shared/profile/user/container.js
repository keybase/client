// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import * as Styles from '../../styles'
import Profile2 from '.'
import type {RouteProps} from '../../route-tree/render-route'
import type {Response} from 'react-native-image-picker'

type OwnProps = RouteProps<{username: string}, {}>
const emptySet = I.OrderedSet()

const headerBackgroundColor = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return Styles.globalColors.red
  } else {
    return followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }
}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.routeProps.get('username')
  const d = state.tracker2.usernameToDetails.get(username, Constants.noDetails)
  const followThem = Constants.followThem(state, username)

  return {
    _assertions: d.assertions,
    _userIsYou: username === state.config.username,
    backgroundColor: headerBackgroundColor(d.state, followThem),
    followThem,
    followers: state.tracker2.usernameToDetails.getIn([username, 'followers']) || emptySet,
    following: state.tracker2.usernameToDetails.getIn([username, 'following']) || emptySet,
    guiID: d.guiID,
    state: d.state,
    username,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  _onEditAvatar: (image?: Response) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {image}, selected: 'editAvatar'}]})),
  _onReload: (assertion: string) => {
    dispatch(
      Tracker2Gen.createLoad({
        assertion,
        guiID: Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    )
  },
  onBack: () => dispatch(ownProps.navigateUp()),
  onSearch: () => {
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'search'}]}))
  },
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
  backgroundColor: stateProps.backgroundColor,
  followThem: stateProps.followThem,
  followers: stateProps.followers.toArray(),
  following: stateProps.following.toArray(),
  onBack: dispatchProps.onBack,
  onEditAvatar: stateProps._userIsYou ? dispatchProps._onEditAvatar : null,
  onReload: () => dispatchProps._onReload(stateProps.username),
  onSearch: dispatchProps.onSearch,
  state: stateProps.state,
  username: stateProps.username,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Profile2'
)(Profile2)
