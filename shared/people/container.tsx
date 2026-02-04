import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import People from '.'
import {useSignupState} from '@/constants/signup'
import {useProfileState} from '@/constants/profile'
import {usePeopleState, getPeopleDataWaitingKey} from '@/constants/people'
import {useCurrentUserState} from '@/constants/current-user'

const waitToRefresh = 1000 * 60 * 5

const PeopleReloadable = () => {
  const followSuggestions = usePeopleState(s => s.followSuggestions)
  const username = useCurrentUserState(s => s.username)
  const newItems = usePeopleState(s => s.newItems)
  const oldItems = usePeopleState(s => s.oldItems)
  const signupEmail = useSignupState(s => s.justSignedUpEmail)
  const waiting = C.Waiting.useAnyWaiting(getPeopleDataWaitingKey)
  const lastRefreshRef = React.useRef<number>(0)

  const loadPeople = usePeopleState(s => s.dispatch.loadPeople)
  // const wotUpdates = Container.useSelector(state => state.people.wotUpdates)

  const getData = React.useCallback(
    (markViewed = true, force = false) => {
      const now = Date.now()
      if (force || !lastRefreshRef.current || lastRefreshRef.current + waitToRefresh < now) {
        lastRefreshRef.current = now
        loadPeople(markViewed, 10)
      }
    },
    [loadPeople]
  )

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)

  const onClickUser = React.useCallback((username: string) => showUserProfile(username), [showUserProfile])

  const onReload = React.useCallback(
    (isRetry?: boolean) => getData(false, isRetry === true || !followSuggestions.length),
    [getData, followSuggestions.length]
  )

  return (
    <Kb.Reloadable onReload={onReload} reloadOnMount={true} waitingKeys={getPeopleDataWaitingKey}>
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
