import * as React from 'react'
import * as T from '@/constants/types'
import * as Chat from '@/stores/chat'
import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {isMobile} from '@/constants/platform'

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10

export const makeInboxSearchInfo = (): T.Chat.InboxSearchInfo => ({
  botsResults: [],
  botsResultsSuggested: false,
  botsStatus: 'initial',
  indexPercent: 0,
  nameResults: [],
  nameResultsUnread: false,
  nameStatus: 'initial',
  openTeamsResults: [],
  openTeamsResultsSuggested: false,
  openTeamsStatus: 'initial',
  query: '',
  selectedIndex: 0,
  textResults: [],
  textStatus: 'initial',
})

const getInboxSearchSelected = (
  inboxSearch: T.Immutable<T.Chat.InboxSearchInfo>
):
  | undefined
  | {
      conversationIDKey: T.Chat.ConversationIDKey
      query?: string
    } => {
  const {selectedIndex, nameResults, botsResults, openTeamsResults, textResults} = inboxSearch
  const firstTextResultIdx = botsResults.length + openTeamsResults.length + nameResults.length
  const firstOpenTeamResultIdx = nameResults.length

  if (selectedIndex < firstOpenTeamResultIdx) {
    const maybeNameResults = nameResults[selectedIndex]
    const conversationIDKey = maybeNameResults === undefined ? undefined : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (selectedIndex < firstTextResultIdx) {
    return
  } else if (selectedIndex >= firstTextResultIdx) {
    const result = textResults[selectedIndex - firstTextResultIdx]
    if (result) {
      return {
        conversationIDKey: result.conversationIDKey,
        query: result.query,
      }
    }
  }
  return
}

export const nextInboxSearchSelectedIndex = (
  inboxSearch: T.Immutable<T.Chat.InboxSearchInfo>,
  increment: boolean
) => {
  const {selectedIndex} = inboxSearch
  const totalResults = inboxSearch.nameResults.length + inboxSearch.textResults.length
  if (increment && selectedIndex < totalResults - 1) {
    return selectedIndex + 1
  }
  if (!increment && selectedIndex > 0) {
    return selectedIndex - 1
  }
  return selectedIndex
}

type Store = T.Immutable<{
  enabled: boolean
  searchInfo: T.Chat.InboxSearchInfo
}>

const initialStore: Store = {
  enabled: false,
  searchInfo: makeInboxSearchInfo(),
}

type State = Store & {
  dispatch: {
    cancelSearch: () => void
    moveSelectedIndex: (increment: boolean) => void
    resetState: () => void
    select: (
      conversationIDKey?: T.Chat.ConversationIDKey,
      query?: string,
      selectedIndex?: number
    ) => void
    setQuery: (query: string) => void
    startSearch: () => void
  }
}

export const useInboxSearchState = Z.createZustand<State>(set => {
  let activeSearchID = 0

  const cancelActiveSearch = () => {
    const f = async () => {
      try {
        await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
      } catch {}
    }
    ignorePromise(f())
  }

  const isActiveSearch = (searchID: number) =>
    searchID === activeSearchID && useInboxSearchState.getState().enabled

  const runSearch = (query: string) => {
    const searchID = ++activeSearchID
    set(s => {
      s.searchInfo.query = query
    })
    const f = async () => {
      try {
        await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
      } catch {}

      if (!isActiveSearch(searchID) || useInboxSearchState.getState().searchInfo.query !== query) {
        return
      }

      const teamType = (t: T.RPCChat.TeamType) => (t === T.RPCChat.TeamType.complex ? 'big' : 'small')

      const updateIfActive = (updater: (draft: T.Chat.InboxSearchInfo) => void) => {
        if (!isActiveSearch(searchID)) {
          return
        }
        set(s => {
          if (!isActiveSearch(searchID)) {
            return
          }
          updater(s.searchInfo)
        })
      }

      const onConvHits = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']) => {
        const results = (resp.hits.hits || []).reduce<Array<T.Chat.InboxSearchConvHit>>((arr, h) => {
          arr.push({
            conversationIDKey: T.Chat.stringToConversationIDKey(h.convID),
            name: h.name,
            teamType: teamType(h.teamType),
          })
          return arr
        }, [])

        updateIfActive(draft => {
          draft.nameResults = results
          draft.nameResultsUnread = resp.hits.unreadMatches
          draft.nameStatus = 'success'
        })

        const missingMetas = results.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
          if (!Chat.getConvoState(r.conversationIDKey).isMetaGood()) {
            arr.push(r.conversationIDKey)
          }
          return arr
        }, [])
        if (missingMetas.length > 0) {
          Chat.useChatState.getState().dispatch.unboxRows(missingMetas, true)
        }
      }

      const onOpenTeamHits = (
        resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']
      ) => {
        const results = (resp.hits.hits || []).reduce<Array<T.Chat.InboxSearchOpenTeamHit>>((arr, h) => {
          const {description, name, memberCount, inTeam} = h
          arr.push({
            description: description ?? '',
            inTeam,
            memberCount,
            name,
            publicAdmins: [],
          })
          return arr
        }, [])
        updateIfActive(draft => {
          draft.openTeamsResultsSuggested = resp.hits.suggestedMatches
          draft.openTeamsResults = T.castDraft(results)
          draft.openTeamsStatus = 'success'
        })
      }

      const onBotsHits = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']) => {
        updateIfActive(draft => {
          draft.botsResultsSuggested = resp.hits.suggestedMatches
          draft.botsResults = T.castDraft(resp.hits.hits || [])
          draft.botsStatus = 'success'
        })
      }

      const onTextHit = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
        const {convID, convName, hits, teamType: tt, time} = resp.searchHit
        const result = {
          conversationIDKey: T.Chat.conversationIDToKey(convID),
          name: convName,
          numHits: hits?.length ?? 0,
          query: resp.searchHit.query,
          teamType: teamType(tt),
          time,
        } as const

        updateIfActive(draft => {
          const textResults = draft.textResults.filter(r => r.conversationIDKey !== result.conversationIDKey)
          textResults.push(result)
          draft.textResults = textResults.sort((l, r) => r.time - l.time)
        })

        if (
          Chat.getConvoState(result.conversationIDKey).meta.conversationIDKey === T.Chat.noConversationIDKey
        ) {
          Chat.useChatState.getState().dispatch.unboxRows([result.conversationIDKey], true)
        }
      }

      const onStart = () => {
        updateIfActive(draft => {
          draft.nameStatus = 'inprogress'
          draft.selectedIndex = 0
          draft.textResults = []
          draft.textStatus = 'inprogress'
          draft.openTeamsStatus = 'inprogress'
          draft.botsStatus = 'inprogress'
        })
      }

      const onDone = () => {
        updateIfActive(draft => {
          draft.textStatus = 'success'
        })
      }

      const onIndexStatus = (
        resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
      ) => {
        updateIfActive(draft => {
          draft.indexPercent = resp.status.percentIndexed
        })
      }

      try {
        await T.RPCChat.localSearchInboxRpcListener({
          incomingCallMap: {
            'chat.1.chatUi.chatSearchBotHits': onBotsHits,
            'chat.1.chatUi.chatSearchConvHits': onConvHits,
            'chat.1.chatUi.chatSearchInboxDone': onDone,
            'chat.1.chatUi.chatSearchInboxHit': onTextHit,
            'chat.1.chatUi.chatSearchInboxStart': onStart,
            'chat.1.chatUi.chatSearchIndexStatus': onIndexStatus,
            'chat.1.chatUi.chatSearchTeamHits': onOpenTeamHits,
          },
          params: {
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            namesOnly: false,
            opts: {
              afterContext: 0,
              beforeContext: 0,
              isRegex: false,
              matchMentions: false,
              maxBots: 10,
              maxConvsHit: inboxSearchMaxTextResults,
              maxConvsSearched: 0,
              maxHits: inboxSearchMaxTextMessages,
              maxMessages: -1,
              maxNameConvs: query.length > 0 ? inboxSearchMaxNameResults : inboxSearchMaxUnreadNameResults,
              maxTeams: 10,
              reindexMode: T.RPCChat.ReIndexingMode.postsearchSync,
              sentAfter: 0,
              sentBefore: 0,
              sentBy: '',
              sentTo: '',
              skipBotCache: false,
            },
            query,
          },
        })
      } catch (error) {
        if (error instanceof RPCError && error.code !== T.RPCGen.StatusCode.sccanceled) {
          logger.error('search failed: ' + error.message)
          updateIfActive(draft => {
            draft.textStatus = 'error'
          })
        }
      }
    }
    ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    cancelSearch: () => {
      activeSearchID++
      set(s => {
        s.enabled = false
        s.searchInfo = T.castDraft(makeInboxSearchInfo())
      })
      cancelActiveSearch()
    },
    moveSelectedIndex: increment => {
      set(s => {
        s.searchInfo.selectedIndex = nextInboxSearchSelectedIndex(s.searchInfo, increment)
      })
    },
    resetState: () => {
      activeSearchID++
      set(s => {
        s.enabled = false
        s.searchInfo = T.castDraft(makeInboxSearchInfo())
      })
      cancelActiveSearch()
    },
    select: (_conversationIDKey, q, selectedIndex) => {
      let conversationIDKey = _conversationIDKey
      let query = q
      if (selectedIndex !== undefined) {
        set(s => {
          s.searchInfo.selectedIndex = selectedIndex
        })
      }

      const {enabled, searchInfo} = useInboxSearchState.getState()
      if (!enabled) {
        return
      }

      const selected = getInboxSearchSelected(searchInfo)
      if (!conversationIDKey) {
        conversationIDKey = selected?.conversationIDKey
      }
      if (!conversationIDKey) {
        return
      }
      if (!query) {
        query = selected?.query
      }

      if (query) {
        Chat.getConvoState(conversationIDKey).dispatch.navigateToThread(
          'inboxSearch',
          undefined,
          undefined,
          query
        )
      } else {
        Chat.getConvoState(conversationIDKey).dispatch.navigateToThread('inboxSearch')
        dispatch.cancelSearch()
      }
    },
    setQuery: query => {
      if (!useInboxSearchState.getState().enabled) {
        return
      }
      runSearch(query)
    },
    startSearch: () => {
      if (useInboxSearchState.getState().enabled) {
        return
      }
      set(s => {
        s.enabled = true
        s.searchInfo = T.castDraft(makeInboxSearchInfo())
      })
      runSearch('')
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})

export const InboxSearchProvider = ({children}: {children: React.ReactNode}) => {
  const mobileAppState = useConfigState(s => s.mobileAppState)
  const enabled = useInboxSearchState(s => s.enabled)
  const cancelSearch = useInboxSearchState(s => s.dispatch.cancelSearch)
  const resetState = useInboxSearchState(s => s.dispatch.resetState)

  React.useEffect(() => {
    resetState()
    return () => {
      resetState()
    }
  }, [resetState])

  React.useEffect(() => {
    if (mobileAppState === 'background' && enabled) {
      cancelSearch()
    }
  }, [mobileAppState, enabled, cancelSearch])

  return <>{children}</>
}
