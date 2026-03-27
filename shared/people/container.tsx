import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {DebouncedFunc} from 'lodash'
import debounce from 'lodash/debounce'
import isEqual from 'lodash/isEqual'
import People from '.'
import {getPeopleDataWaitingKey, reducePeopleScreenData} from './page-state'
import * as T from '@/constants/types'
import {useFollowerState} from '@/stores/followers'
import {useSignupState} from '@/stores/signup'
import {useProfileState} from '@/stores/profile'
import {usePeopleState} from '@/stores/people'
import {useCurrentUserState} from '@/stores/current-user'

const waitToRefresh = 1000 * 60 * 5
const defaultNumFollowSuggestions = 10

const usePeoplePageState = () => {
  const [followSuggestions, setFollowSuggestions] = React.useState<Array<T.People.FollowSuggestion>>([])
  const [newItems, setNewItems] = React.useState<Array<T.People.PeopleScreenItem>>([])
  const [oldItems, setOldItems] = React.useState<Array<T.People.PeopleScreenItem>>([])
  const [resentEmail, setResentEmail] = React.useState('')
  const {followers, following} = useFollowerState(
    C.useShallow(s => ({
      followers: s.followers,
      following: s.following,
    }))
  )
  const loadPeopleRPC = C.useRPC(T.RPCGen.homeHomeGetScreenRpcPromise)
  const dismissAnnouncementRPC = C.useRPC(T.RPCGen.homeHomeDismissAnnouncementRpcPromise)
  const skipTodoRPC = C.useRPC(T.RPCGen.homeHomeSkipTodoTypeRpcPromise)
  const mountedRef = React.useRef(true)
  const debouncedLoadPeopleRef = React.useRef<
    DebouncedFunc<(markViewed: boolean, numFollowSuggestionsWanted?: number) => void> | null
  >(null)

  const loadPeople = React.useEffectEvent(
    (markViewed: boolean, numFollowSuggestionsWanted: number = defaultNumFollowSuggestions) => {
      loadPeopleRPC(
        [{markViewed, numFollowSuggestionsWanted}, getPeopleDataWaitingKey],
        data => {
          if (!mountedRef.current) {
            return
          }

          const nextState = reducePeopleScreenData(data, followers, following)
          setFollowSuggestions(s => (isEqual(s, nextState.followSuggestions) ? s : nextState.followSuggestions))
          setNewItems(s => (isEqual(s, nextState.newItems) ? s : nextState.newItems))
          setOldItems(s => (isEqual(s, nextState.oldItems) ? s : nextState.oldItems))
        },
        _ => {}
      )
    }
  )

  if (debouncedLoadPeopleRef.current == null) {
    debouncedLoadPeopleRef.current = debounce(
      (markViewed: boolean, numFollowSuggestionsWanted: number = defaultNumFollowSuggestions) => {
        loadPeople(markViewed, numFollowSuggestionsWanted)
      },
      1000,
      {leading: true, trailing: false}
    )
  }

  React.useEffect(
    () => () => {
      mountedRef.current = false
      debouncedLoadPeopleRef.current?.cancel()
    },
    []
  )

  const dismissAnnouncement = (id: T.RPCGen.HomeScreenAnnouncementID) => {
    dismissAnnouncementRPC([{i: id}], () => {}, _ => {})
  }

  const queueLoadPeople = (markViewed: boolean, numFollowSuggestionsWanted: number = defaultNumFollowSuggestions) => {
    debouncedLoadPeopleRef.current?.(markViewed, numFollowSuggestionsWanted)
  }

  const skipTodo = (type: T.People.TodoType) => {
    skipTodoRPC(
      [{t: T.RPCGen.HomeScreenTodoType[type]}],
      () => {
        mountedRef.current && queueLoadPeople(false)
      },
      _ => {}
    )
  }

  return {
    dismissAnnouncement,
    followSuggestions,
    loadPeople: queueLoadPeople,
    newItems,
    oldItems,
    resentEmail,
    setResentEmail,
    skipTodo,
  }
}

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
