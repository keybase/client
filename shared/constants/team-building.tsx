import * as C from '.'
import * as RPCTypes from './types/rpc-gen'
import * as React from 'react'
import * as Z from '../util/zustand'
import logger from '../logger'
import trim from 'lodash/trim'
import type * as Types from './types/team-building'
import type {TeamRoleType} from './types/teams'
import {RPCError} from '../util/errors'
import {mapGetEnsureValue} from '../util/map'
import {serviceIdFromString} from '../util/platforms'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import {validateEmailAddress} from '../util/email-address'

const searchServices: Array<Types.ServiceId> = ['keybase', 'twitter', 'github', 'reddit', 'hackernews']

// Order here determines order of tabs in team building
export const allServices: Array<Types.ServiceIdWithContact> = [
  ...searchServices.slice(0, 1),
  'phone',
  'email',
  ...searchServices.slice(1),
]

export const selfToUser = (you: string): Types.User => ({
  id: you,
  prettyName: you,
  serviceId: 'keybase' as const,
  serviceMap: {},
  username: you,
})

export const searchWaitingKey = 'teamBuilding:search'

export type Store = {
  namespace: Types.AllowedNamespace
  error: string
  teamSoFar: Set<Types.User>
  searchResults: Types.SearchResults
  serviceResultCount: Types.ServiceResultCount
  finishedTeam: Set<Types.User>
  finishedSelectedRole: TeamRoleType
  finishedSendNotification: boolean
  searchQuery: Types.Query
  selectedService: Types.ServiceIdWithContact
  searchLimit: number
  userRecs?: Array<Types.User>
  selectedRole: TeamRoleType
  sendNotification: boolean
}
export const initialStore: Store = {
  error: '',
  finishedSelectedRole: 'writer',
  finishedSendNotification: true,
  finishedTeam: new Set(),
  namespace: 'invalid',
  searchLimit: 11,
  searchQuery: '',
  searchResults: new Map(),
  selectedRole: 'writer',
  selectedService: 'keybase',
  sendNotification: true,
  serviceResultCount: new Map(),
  teamSoFar: new Set(),
}

export type State = Store & {
  dispatch: {
    addUsersToTeamSoFar: (users: Array<Types.User>) => void
    cancelTeamBuilding: () => void
    changeSendNotification: (sendNotification: boolean) => void
    closeTeamBuilding: () => void
    fetchUserRecs: () => void
    finishTeamBuilding: () => void
    finishedTeamBuilding: () => void
    removeUsersFromTeamSoFar: (users: Array<Types.UserID>) => void
    resetState: () => void
    search: (
      query: string,
      service: Types.ServiceIdWithContact,
      includeContacts: boolean,
      limit?: number
    ) => void
    selectRole: (role: TeamRoleType) => void
    setError: (error: string) => void
  }
}

const namespaceToRoute = new Map([
  ['chat2', 'chatNewChat'],
  ['crypto', 'cryptoTeamBuilder'],
  ['teams', 'teamsTeamBuilder'],
  ['people', 'peopleTeamBuilder'],
])

const parseRawResultToUser = (
  result: RPCTypes.APIUserSearchResult,
  service: Types.ServiceIdWithContact
): Types.User | undefined => {
  const serviceMap = Object.keys(result.servicesSummary || {}).reduce<{[key: string]: string}>(
    (acc, service_name) => {
      acc[service_name] = result.servicesSummary[service_name]?.username ?? ''
      return acc
    },
    {}
  )

  // Add the keybase service to the service map since it isn't there by default
  if (result.keybase) {
    serviceMap['keybase'] = result.keybase.username
  }

  if (service === 'keybase' && result.keybase) {
    return {
      id: result.keybase.username,
      prettyName: result.keybase.fullName || result.keybase.username,
      serviceId: 'keybase' as const,
      serviceMap,
      username: result.keybase.username,
    }
  } else if (service === 'keybase' && result.contact) {
    const serviceId = result.contact.component.phoneNumber ? 'phone' : 'email'
    return {
      contact: true,
      id: result.contact.assertion,
      label: result.contact.displayLabel,
      prettyName: result.contact.displayName,
      serviceId,
      serviceMap: {...result.contact.serviceMap, keybase: result.contact.username},
      username: result.contact.component.email || result.contact.component.phoneNumber || '',
    }
  } else if (result.imptofu) {
    const serviceId = result.imptofu.assertionKey === 'phone' ? 'phone' : 'email'
    return {
      id: result.imptofu.assertion,
      label: result.imptofu.label,
      prettyName: result.imptofu.prettyName,
      serviceId,
      serviceMap: {...serviceMap, keybase: result.imptofu.keybaseUsername},
      username: result.imptofu.assertionValue,
    }
  } else if (result.service) {
    if (result.service.serviceName !== service) {
      // This shouldn't happen
      logger.error(
        `Search result's service_name is different than given service name. Expected: ${service} received ${result.service.serviceName}`
      )
      return
    }
    const kbPrettyName = result.keybase && (result.keybase.fullName || result.keybase.username)
    const prettyName = result.service.fullName || kbPrettyName || ''
    const pictureUrl = result.keybase?.pictureUrl || result.service?.pictureUrl
    let id = `${result.service.username}@${result.service.serviceName}`
    if (result.keybase) {
      // If it's also a keybase user, make a compound assertion.
      id += `+${result.keybase.username}`
    }

    return {
      id,
      pictureUrl,
      prettyName,
      serviceId: service,
      serviceMap,
      username: result.service.username,
    }
  }
  return
}

const apiSearch = async (
  query: string,
  service: Types.ServiceIdWithContact,
  maxResults: number,
  includeServicesSummary: boolean,
  includeContacts: boolean
): Promise<Array<Types.User>> => {
  try {
    const results = await RPCTypes.userSearchUserSearchRpcPromise(
      {
        includeContacts: service === 'keybase' && includeContacts,
        includeServicesSummary,
        maxResults,
        query,
        service,
      },
      searchWaitingKey
    )
    return (results || []).reduce<Array<Types.User>>((arr, r) => {
      const u = parseRawResultToUser(r, service)
      u && arr.push(u)
      return arr
    }, [])
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Error in searching for ${query} on ${service}. ${error.message}`)
    }
    return []
  }
}

const apiSearchOne = async (
  query: string,
  service: Types.ServiceIdWithContact
): Promise<Types.User | undefined> =>
  (
    await apiSearch(
      query,
      service,
      1 /* maxResults */,
      true /* serviceSummaries */,
      false /* includeContacts */
    )
  )[0]
// If the query is a well-formatted phone number or email, do additional search
// and if the result is not already in the list, insert at the beginning.
async function specialContactSearch(users: Types.User[], query: string, region?: string) {
  const {validateNumber} = await import('../util/phone-numbers')
  let result: Types.User | undefined
  const phoneNumber = validateNumber(query, region)
  if (phoneNumber.valid) {
    result = await apiSearchOne(phoneNumber.e164, 'phone')
  } else if (validateEmailAddress(query)) {
    result = await apiSearchOne(query, 'email')
  }
  if (result && !users.find(x => result && x.id === result.id)) {
    // Overwrite `prettyName` to make the special result stand out.
    result.prettyName = query
    return [result, ...users]
  }
  return users
}

type HasServiceMap = {
  username: string
  serviceMap: {[key: string]: string}
}

const pluckServiceMap = (contact: HasServiceMap) =>
  Object.entries(contact.serviceMap || {})
    .concat([['keybase', contact.username]])
    .reduce<Types.ServiceMap>((acc, [service, username]) => {
      if (serviceIdFromString(service) === service) {
        // Service can also give us proof values like "https" or "dns" that
        // we don't want here.
        acc[service] = username
      }
      return acc
    }, {})

const contactToUser = (contact: RPCTypes.ProcessedContact): Types.User => ({
  contact: true,
  id: contact.assertion,
  label: contact.displayLabel,
  prettyName: contact.displayName,
  serviceId: contact.component.phoneNumber ? 'phone' : 'email',
  serviceMap: pluckServiceMap(contact),
  username: contact.component.email || contact.component.phoneNumber || '',
})

const interestingPersonToUser = (person: RPCTypes.InterestingPerson): Types.User => {
  const {username, fullname} = person
  return {
    id: username,
    prettyName: fullname,
    serviceId: 'keybase' as const,
    serviceMap: pluckServiceMap(person),
    username: username,
  }
}

const createSlice: Z.ImmerStateCreator<State> = (set, get) => {
  const dispatch: State['dispatch'] = {
    addUsersToTeamSoFar: users => {
      set(s => {
        users.forEach(u => {
          s.teamSoFar.add(u)
        })
      })

      const {teamSoFar, namespace} = get()
      if (teamSoFar.size) {
        switch (namespace) {
          case 'people': {
            for (const user of teamSoFar) {
              const username = user.serviceMap.keybase || user.id
              C.useProfileState.getState().dispatch.showUserProfile(username)
              break
            }
            // stop a silly race
            setTimeout(() => {
              get().dispatch.cancelTeamBuilding()
            }, 100)
            break
          }
          default:
        }
      }
    },
    cancelTeamBuilding: () => {
      get().dispatch.resetState()
      get().dispatch.closeTeamBuilding()
    },
    changeSendNotification: sendNotification => {
      set(s => {
        s.sendNotification = sendNotification
      })
    },
    closeTeamBuilding: () => {
      const modals = C.getModalStack()
      const routeNames = [...namespaceToRoute.values()]
      const routeName = modals[modals.length - 1]?.name
      if (routeNames.includes(routeName ?? '')) {
        C.useRouterState.getState().dispatch.clearModals()
      }
    },
    fetchUserRecs: () => {
      const includeContacts = get().namespace === 'chat2'
      const f = async () => {
        try {
          const [_suggestionRes, _contactRes] = await Promise.all([
            RPCTypes.userInterestingPeopleRpcPromise({maxUsers: 50, namespace: get().namespace}),
            includeContacts
              ? RPCTypes.contactsGetContactsForUserRecommendationsRpcPromise()
              : Promise.resolve([] as RPCTypes.ProcessedContact[]),
          ])
          const suggestionRes = _suggestionRes || []
          const contactRes = _contactRes || []
          const contacts = contactRes.map(contactToUser)
          let suggestions = suggestionRes.map(interestingPersonToUser)
          const expectingContacts = C.useSettingsContactsState.getState().importEnabled && includeContacts
          if (expectingContacts) {
            suggestions = suggestions.slice(0, 10)
          }
          set(s => {
            s.userRecs = suggestions.concat(contacts)
          })
        } catch (err) {
          logger.error(`Error in fetching recs: ${String(err)}`)
          set(s => {
            s.userRecs = []
          })
        }
      }
      Z.ignorePromise(f())
    },
    finishTeamBuilding: () => {
      set(s => {
        s.error = ''
      })
      get().dispatch.closeTeamBuilding()
      const {teamSoFar} = get()
      if (get().namespace === 'teams') {
        C.useTeamsState
          .getState()
          .dispatch.addMembersWizardPushMembers(
            [...teamSoFar].map(user => ({assertion: user.id, role: 'writer'}))
          )
        get().dispatch.finishedTeamBuilding()
      }
    },
    finishedTeamBuilding: () => {
      set(s => {
        return {
          ...initialStore,
          finishedSelectedRole: s.selectedRole,
          finishedSendNotification: s.sendNotification,
          finishedTeam: s.teamSoFar,
          namespace: s.namespace,
          selectedRole: s.selectedRole,
          sendNotification: s.sendNotification,
          teamSoFar: s.teamSoFar,
        }
      })
      const {finishedTeam, namespace} = get()
      switch (namespace) {
        case 'crypto': {
          C.useCryptoState.getState().dispatch.onTeamBuildingFinished(finishedTeam)
          break
        }
        case 'chat2': {
          C.useChatState.getState().dispatch.onTeamBuildingFinished(finishedTeam)
          break
        }
        default:
      }
      get().dispatch.closeTeamBuilding()
    },
    removeUsersFromTeamSoFar: users => {
      set(s => {
        users.forEach(u => {
          for (const t of s.teamSoFar.values()) {
            if (t.id === u) {
              s.teamSoFar.delete(t)
              break
            }
          }
        })
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        namespace: s.namespace,
      }))
    },
    search: (query, service, includeContacts, limit) => {
      set(s => {
        s.searchLimit = limit ?? 11
        s.searchQuery = trim(query)
        s.selectedService = service
      })
      const f = async () => {
        const {searchQuery, selectedService, searchLimit} = get()
        // We can only ask the api for at most 100 results
        if (searchLimit > 100) {
          logger.info('ignoring search request with a limit over 100')
          return
        }
        // Do the main search for selected service and query.
        let users = await apiSearch(
          searchQuery,
          selectedService,
          searchLimit,
          true /* includeServicesSummary */,
          includeContacts
        )
        if (selectedService === 'keybase') {
          // If we are on Keybase tab, do additional search if query is phone/email.
          const userRegion = C.useSettingsContactsState.getState().userCountryCode
          users = await specialContactSearch(users, searchQuery, userRegion)
        }
        set(s => {
          const results = mapGetEnsureValue(s.searchResults, searchQuery, new Map())
          results.set(selectedService, users)
        })

        const updates = users.reduce((arr, {serviceMap, prettyName}) => {
          const {keybase} = serviceMap
          if (keybase) {
            arr.push({info: {fullname: prettyName}, name: keybase})
          }
          return arr
        }, new Array<{info: {fullname: string}; name: string}>())
        C.useUsersState.getState().dispatch.updates(updates)
        const blocks = users.reduce((arr, {serviceMap}) => {
          const {keybase} = serviceMap
          if (keybase) {
            arr.push(keybase)
          }
          return arr
        }, new Array<string>())
        blocks.length && C.useUsersState.getState().dispatch.getBlockState(blocks)
      }
      Z.ignorePromise(f())
    },
    selectRole: role => {
      set(s => {
        s.selectedRole = role
      })
    },
    setError: error => {
      set(s => {
        s.error = error
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
}

type MadeStore = UseBoundStore<StoreApi<State>>
export const _stores = new Map<Types.AllowedNamespace, MadeStore>()

const createTBStore = (namespace: Types.AllowedNamespace) => {
  const existing = _stores.get(namespace)
  if (existing) return existing
  const next = Z.createZustand<State>(createSlice)
  next.setState({namespace})
  _stores.set(namespace, next)
  return next
}

const Context = React.createContext<MadeStore | null>(null)

type TBProviderProps = React.PropsWithChildren<{namespace: Types.AllowedNamespace}>
export function _Provider({children, ...props}: TBProviderProps) {
  const storeRef = React.useRef<MadeStore>()
  if (!storeRef.current) {
    storeRef.current = createTBStore(props.namespace)
  }
  return <Context.Provider value={storeRef.current}>{children}</Context.Provider>
}

export function _useContext<T>(
  selector: (state: State) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(Context)
  if (!store) throw new Error('Missing TeambuildingContext.Provider in the tree')
  return useStore(store, selector, equalityFn)
}
