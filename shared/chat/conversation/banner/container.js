// @flow
// import * as Constants from '../../../constants/chat2'
import {BrokenTrackerBanner, InviteBanner} from '.'
import {
  compose,
  branch,
  renderNothing,
  renderComponent,
  connect,
  type TypedState,
} from '../../../util/container'
// import {createSelector} from 'reselect'
import {createGetProfile} from '../../../actions/tracker-gen'
import {isMobile} from '../../../constants/platform'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {Box} from '../../../common-adapters'

// const getBannerMessage = createSelector(
// [Constants.getYou, Constants.getParticipants, Constants.getMetaDataMap],
// (you, participants, metaDataMap) => {
// const brokenUsers = Constants.getBrokenUsers(participants, you, metaDataMap)
// if (brokenUsers.length) {
// return {
// type: 'BrokenTracker',
// users: brokenUsers,
// }
// }

// const sbsUsers = participants.filter(p => p.includes('@'))
// if (sbsUsers.length) {
// return {
// type: 'Invite',
// users: sbsUsers,
// }
// }

// return null
// }
// )

const mapStateToProps = (state: TypedState) => ({
  // TODO
  // ...getBannerMessage(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: (username: string) => {
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true}))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => !props, renderNothing),
  // $FlowIssue gets very confused here
  branch(({type}) => type === 'Invite', renderComponent(InviteBanner)),
  // $FlowIssue gets very confused here
  branch(({type}) => type === 'BrokenTracker', renderComponent(BrokenTrackerBanner), renderNothing)
)(Box)
