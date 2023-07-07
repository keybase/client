import * as React from 'react'
import * as Constants from '../constants/people'
import * as SignupConstants from '../constants/signup'
import * as ProfileConstants from '../constants/profile'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import People from '.'

let lastRefresh: number = 0
const waitToRefresh = 1000 * 60 * 5

const PeopleReloadable = () => {
  const followSuggestions = Constants.useState(s => s.followSuggestions)
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const newItems = Constants.useState(s => s.newItems)
  const oldItems = Constants.useState(s => s.oldItems)
  const signupEmail = SignupConstants.useState(s => s.justSignedUpEmail)
  const waiting = Container.useAnyWaiting(Constants.getPeopleDataWaitingKey)

  const loadPeople = Constants.useState(s => s.dispatch.loadPeople)
  // const wotUpdates = Container.useSelector(state => state.people.wotUpdates)

  const getData = React.useCallback(
    (markViewed = true, force = false) => {
      const now = Date.now()
      if (force || !lastRefresh || lastRefresh + waitToRefresh < now) {
        lastRefresh = now
        loadPeople(markViewed, 10)
      }
    },
    [loadPeople]
  )

  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)

  const onClickUser = React.useCallback((username: string) => showUserProfile(username), [showUserProfile])

  const onReload = React.useCallback(
    () => getData(false, !followSuggestions.length),
    [getData, followSuggestions.length]
  )

  return (
    <Kb.Reloadable onReload={onReload} reloadOnMount={true} waitingKeys={Constants.getPeopleDataWaitingKey}>
      <People
        followSuggestions={followSuggestions}
        getData={getData}
        myUsername={username}
        newItems={newItems}
        oldItems={oldItems}
        onClickUser={onClickUser}
        signupEmail={signupEmail}
        waiting={waiting}
        // wotUpdates={wotUpdates}
      />
    </Kb.Reloadable>
  )
}
export default PeopleReloadable
