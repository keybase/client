// @flow
import * as Constants from '../../../constants/chat'
import {BrokenTrackerBanner, InviteBanner} from '.'
import {
  compose,
  branch,
  renderNothing,
  renderComponent,
  connect,
  type TypedState,
} from '../../../util/container'
import {createSelector} from 'reselect'
import {getProfile} from '../../../actions/tracker'
import {isMobile} from '../../../constants/platform'
import {showUserProfile} from '../../../actions/profile'
import {Box} from '../../../common-adapters'

const getBannerMessage = createSelector(
  [Constants.getYou, Constants.getParticipants, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, participants, followingMap, metaDataMap) => {
    const brokenUsers = Constants.getBrokenUsers(participants, you, metaDataMap)
    if (brokenUsers.length) {
      return {
        type: 'BrokenTracker',
        users: brokenUsers,
      }
    }

    const sbsUsers = participants.filter(p => p.includes('@'))
    if (sbsUsers.length) {
      return {
        type: 'Invite',
        users: sbsUsers,
      }
    }

    return null
  }
)

const mapStateToProps = (state: TypedState) => ({
  ...getBannerMessage(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => !props, renderNothing),
  branch(({type}) => type === 'Invite', renderComponent(InviteBanner)),
  branch(({type}) => type === 'BrokenTracker', renderComponent(BrokenTrackerBanner), renderNothing)
)(Box)
