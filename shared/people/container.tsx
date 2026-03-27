import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import People from '.'
import {getPeopleDataWaitingKey, usePeoplePageState} from './page-state'
import {useSignupState} from '@/stores/signup'
import {useProfileState} from '@/stores/profile'
import {usePeopleState} from '@/stores/people'
import {useCurrentUserState} from '@/stores/current-user'

const waitToRefresh = 1000 * 60 * 5

const PeopleReloadable = () => {
  const {
    dismissAnnouncement,
    followSuggestions,
    loadPeople,
    newItems,
    oldItems,
    resentEmail,
    setResentEmail,
    skipTodo,
  } = usePeoplePageState()
  const refreshCount = usePeopleState(s => s.refreshCount)
  const username = useCurrentUserState(s => s.username)
  const signupEmail = useSignupState(s => s.justSignedUpEmail)
  const waiting = C.Waiting.useAnyWaiting(getPeopleDataWaitingKey)
  const lastRefreshRef = React.useRef(0)
  const lastSeenRefreshRef = React.useRef(refreshCount)

  const getData = React.useEffectEvent((markViewed = true, force = false) => {
    const now = Date.now()
    if (force || !lastRefreshRef.current || lastRefreshRef.current + waitToRefresh < now) {
      lastRefreshRef.current = now
      loadPeople(markViewed, 10)
    }
  })

  React.useEffect(() => {
    if (refreshCount !== lastSeenRefreshRef.current) {
      lastSeenRefreshRef.current = refreshCount
      getData(false, true)
    }
  }, [refreshCount])

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)

  const onClickUser = (username: string) => showUserProfile(username)

  const onReload = (isRetry?: boolean) => getData(false, isRetry === true || !followSuggestions.length)

  return (
    <Kb.Reloadable onReload={onReload} reloadOnMount={true} waitingKeys={getPeopleDataWaitingKey}>
      <People
        followSuggestions={followSuggestions}
        getData={getData}
        myUsername={username}
        newItems={newItems}
        oldItems={oldItems}
        onClickUser={onClickUser}
        dismissAnnouncement={dismissAnnouncement}
        resentEmail={resentEmail}
        setResentEmail={setResentEmail}
        signupEmail={signupEmail}
        skipTodo={skipTodo}
        waiting={waiting}
        // wotUpdates={wotUpdates}
      />
    </Kb.Reloadable>
  )
}
export default PeopleReloadable
