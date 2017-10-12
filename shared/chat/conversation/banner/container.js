// @flow
import * as Constants from '../../../constants/chat'
import {BrokenTrackerBanner, InviteBanner} from '.'
import {List} from 'immutable'
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
  [Constants.getYou, Constants.getTLF, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) => {
    const participants = List(tlf.split(','))
    const brokenUsers = Constants.getBrokenUsers(participants.toArray(), you, metaDataMap)
    if (brokenUsers.length) {
      return {
        type: 'BrokenTracker',
        users: brokenUsers,
      }
    }

    const sbsUsers = participants.filter(p => p.includes('@'))
    if (sbsUsers.count()) {
      return {
        type: 'Invite',
        users: sbsUsers.toArray(),
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
