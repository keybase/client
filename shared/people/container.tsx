import * as React from 'react'
import * as Constants from '../constants/people'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as PeopleGen from '../actions/people-gen'
import {createShowUserProfile} from '../actions/profile-gen'
import People from '.'

let lastRefresh: number = 0
const waitToRefresh = 1000 * 60 * 5

const PeopleReloadable = () => {
  const followSuggestions = Container.useSelector(state => state.people.followSuggestions)
  const username = Container.useSelector(state => state.config.username)
  const newItems = Container.useSelector(state => state.people.newItems)
  const oldItems = Container.useSelector(state => state.people.oldItems)
  const signupEmail = Container.useSelector(state => state.signup.justSignedUpEmail)
  const waiting = Container.useAnyWaiting(Constants.getPeopleDataWaitingKey)
  const wotUpdates = Container.useSelector(state => state.people.wotUpdates)

  const dispatch = Container.useDispatch()
  const getData = React.useCallback(
    (markViewed = true, force = false) => {
      const now = Date.now()
      if (force || !lastRefresh || lastRefresh + waitToRefresh < now) {
        lastRefresh = now
        dispatch(PeopleGen.createGetPeopleData({markViewed, numFollowSuggestionsWanted: 10}))
      }
    },
    [dispatch]
  )
  const onClickUser = React.useCallback(
    (username: string) => dispatch(createShowUserProfile({username})),
    [dispatch]
  )

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
        wotUpdates={wotUpdates}
      />
    </Kb.Reloadable>
  )
}
export default PeopleReloadable
