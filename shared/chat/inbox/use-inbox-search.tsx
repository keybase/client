import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {RPCError} from '@/util/errors'
import {isMobile} from '@/constants/platform'
import * as Chat from '@/stores/chat'
import * as React from 'react'

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10
export const inboxSearchPreviewSectionSize = 3

export type InboxSearchVisibleResultCounts = {
  bots: number
  names: number
  openTeams: number
  text: number
}

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

const getDefaultVisibleResultCounts = (
  inboxSearch: T.Immutable<T.Chat.InboxSearchInfo>
): InboxSearchVisibleResultCounts => ({
  bots: Math.min(inboxSearch.botsResults.length, inboxSearchPreviewSectionSize),
  names: inboxSearch.nameResults.length || (inboxSearch.nameResultsUnread ? 1 : 0),
  openTeams: Math.min(inboxSearch.openTeamsResults.length, inboxSearchPreviewSectionSize),
  text: inboxSearch.nameResultsUnread ? 0 : inboxSearch.textResults.length,
})

const areVisibleResultCountsEqual = (
  left: InboxSearchVisibleResultCounts,
  right: InboxSearchVisibleResultCounts
) =>
  left.bots === right.bots &&
  left.names === right.names &&
  left.openTeams === right.openTeams &&
  left.text === right.text

const getTotalVisibleResultCount = (visibleResultCounts: InboxSearchVisibleResultCounts) =>
  visibleResultCounts.names +
  visibleResultCounts.openTeams +
  visibleResultCounts.bots +
  visibleResultCounts.text

const clampSelectedIndex = (
  selectedIndex: number,
  visibleResultCounts: InboxSearchVisibleResultCounts
) => {
  const totalResults = getTotalVisibleResultCount(visibleResultCounts)
  if (totalResults <= 0) {
    return 0
  }
  return Math.min(selectedIndex, totalResults - 1)
}

const getInboxSearchSelected = (
  inboxSearch: T.Immutable<T.Chat.InboxSearchInfo>,
  visibleResultCounts = getDefaultVisibleResultCounts(inboxSearch)
):
  | undefined
  | {
      botUsername?: string
      conversationIDKey: T.Chat.ConversationIDKey
      openTeamName?: string
      query?: string
    } => {
  const {selectedIndex, nameResults, textResults} = inboxSearch
  const firstOpenTeamResultIdx = visibleResultCounts.names
  const firstBotResultIdx = firstOpenTeamResultIdx + visibleResultCounts.openTeams
  const firstTextResultIdx = firstBotResultIdx + visibleResultCounts.bots

  if (selectedIndex < firstOpenTeamResultIdx) {
    const maybeNameResults = nameResults[selectedIndex]
    const conversationIDKey = maybeNameResults === undefined ? undefined : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (selectedIndex < firstBotResultIdx) {
    return
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
  increment: boolean,
  visibleResultCounts = getDefaultVisibleResultCounts(inboxSearch)
) => {
  const {selectedIndex} = inboxSearch
  const totalResults = getTotalVisibleResultCount(visibleResultCounts)
  if (increment && selectedIndex < totalResults - 1) {
    return selectedIndex + 1
  }
  if (!increment && selectedIndex > 0) {
    return selectedIndex - 1
  }
  return selectedIndex
}

type SearchInfoUpdater = (prev: T.Chat.InboxSearchInfo) => T.Chat.InboxSearchInfo

export type InboxSearchSelect = (
  conversationIDKey?: T.Chat.ConversationIDKey,
  query?: string,
  selectedIndex?: number
) => void

export type InboxSearchController = {
  cancelSearch: () => void
  isSearching: boolean
  moveSelectedIndex: (increment: boolean) => void
  query: string
  searchInfo: T.Chat.InboxSearchInfo
  selectResult: InboxSearchSelect
  setQuery: (query: string) => void
  setVisibleResultCounts: (visibleResultCounts: InboxSearchVisibleResultCounts) => void
  startSearch: () => void
}

export function useInboxSearch(): InboxSearchController {
  const mobileAppState = useConfigState(s => s.mobileAppState)
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchInfo, setSearchInfo] = React.useState(makeInboxSearchInfo)
  const activeSearchIDRef = React.useRef(0)
  const isSearchingRef = React.useRef(isSearching)
  const searchInfoRef = React.useRef(searchInfo)
  const visibleResultCountsRef = React.useRef(getDefaultVisibleResultCounts(searchInfo))

  React.useEffect(() => {
    isSearchingRef.current = isSearching
  }, [isSearching])

  React.useEffect(() => {
    searchInfoRef.current = searchInfo
  }, [searchInfo])

  const updateSearchInfo = React.useCallback((updater: SearchInfoUpdater) => {
    setSearchInfo(prev => {
      const next = updater(prev)
      searchInfoRef.current = next
      return next
    })
  }, [])

  const cancelActiveSearch = React.useCallback(() => {
    const f = async () => {
      try {
        await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
      } catch {}
    }
    ignorePromise(f())
  }, [])

  const clearSearch = React.useCallback(() => {
    activeSearchIDRef.current++
    isSearchingRef.current = false
    const next = makeInboxSearchInfo()
    searchInfoRef.current = next
    visibleResultCountsRef.current = getDefaultVisibleResultCounts(next)
    setIsSearching(false)
    setSearchInfo(next)
    cancelActiveSearch()
  }, [cancelActiveSearch])

  const isActiveSearch = React.useCallback(
    (searchID: number) => searchID === activeSearchIDRef.current && isSearchingRef.current,
    []
  )

  const runSearch = React.useCallback(
    (query: string) => {
      const searchID = ++activeSearchIDRef.current
      updateSearchInfo(prev => ({...prev, query}))
      const f = async () => {
        try {
          await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
        } catch {}

        if (!isActiveSearch(searchID) || searchInfoRef.current.query !== query) {
          return
        }

        const teamType = (t: T.RPCChat.TeamType) => (t === T.RPCChat.TeamType.complex ? 'big' : 'small')

        const updateIfActive = (updater: SearchInfoUpdater) => {
          if (!isActiveSearch(searchID)) {
            return
          }
          updateSearchInfo(prev => {
            if (!isActiveSearch(searchID)) {
              return prev
            }
            return updater(prev)
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

          updateIfActive(prev => ({
            ...prev,
            nameResults: results,
            nameResultsUnread: resp.hits.unreadMatches,
            nameStatus: 'success',
          }))

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
          updateIfActive(prev => ({
            ...prev,
            openTeamsResults: results,
            openTeamsResultsSuggested: resp.hits.suggestedMatches,
            openTeamsStatus: 'success',
          }))
        }

        const onBotsHits = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']) => {
          updateIfActive(prev => ({
            ...prev,
            botsResults: resp.hits.hits || [],
            botsResultsSuggested: resp.hits.suggestedMatches,
            botsStatus: 'success',
          }))
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

          updateIfActive(prev => {
            const textResults = prev.textResults.filter(r => r.conversationIDKey !== result.conversationIDKey)
            textResults.push(result)
            textResults.sort((l, r) => r.time - l.time)
            return {...prev, textResults}
          })

          if (
            Chat.getConvoState(result.conversationIDKey).meta.conversationIDKey === T.Chat.noConversationIDKey
          ) {
            Chat.useChatState.getState().dispatch.unboxRows([result.conversationIDKey], true)
          }
        }

        const onStart = () => {
          updateIfActive(prev => ({
            ...prev,
            botsStatus: 'inprogress',
            nameStatus: 'inprogress',
            openTeamsStatus: 'inprogress',
            selectedIndex: 0,
            textResults: [],
            textStatus: 'inprogress',
          }))
        }

        const onDone = () => {
          updateIfActive(prev => ({...prev, textStatus: 'success'}))
        }

        const onIndexStatus = (
          resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
        ) => {
          updateIfActive(prev => ({...prev, indexPercent: resp.status.percentIndexed}))
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
            updateIfActive(prev => ({...prev, textStatus: 'error'}))
          }
        }
      }
      ignorePromise(f())
    },
    [isActiveSearch, updateSearchInfo]
  )

  const cancelSearch = React.useCallback(() => {
    clearSearch()
  }, [clearSearch])

  const setVisibleResultCounts = React.useCallback(
    (visibleResultCounts: InboxSearchVisibleResultCounts) => {
      if (areVisibleResultCountsEqual(visibleResultCountsRef.current, visibleResultCounts)) {
        return
      }
      visibleResultCountsRef.current = visibleResultCounts
      setSearchInfo(prev => {
        const selectedIndex = clampSelectedIndex(prev.selectedIndex, visibleResultCounts)
        if (selectedIndex === prev.selectedIndex) {
          return prev
        }
        const next = {...prev, selectedIndex}
        searchInfoRef.current = next
        return next
      })
    },
    []
  )

  const moveSelectedIndex = React.useCallback((increment: boolean) => {
    updateSearchInfo(prev => ({
      ...prev,
      selectedIndex: nextInboxSearchSelectedIndex(prev, increment, visibleResultCountsRef.current),
    }))
  }, [updateSearchInfo])

  const selectResult = React.useCallback<InboxSearchSelect>(
    (_conversationIDKey?: T.Chat.ConversationIDKey, q?: string, selectedIndex?: number) => {
      let conversationIDKey = _conversationIDKey
      let query = q
      let latestSearchInfo = searchInfoRef.current

      if (selectedIndex !== undefined) {
        latestSearchInfo = {...latestSearchInfo, selectedIndex}
        searchInfoRef.current = latestSearchInfo
        setSearchInfo(latestSearchInfo)
      }

      if (!isSearchingRef.current) {
        return
      }

      const selected = getInboxSearchSelected(latestSearchInfo, visibleResultCountsRef.current)
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
        clearSearch()
      }
    },
    [clearSearch]
  )

  const setQuery = React.useCallback(
    (query: string) => {
      if (!isSearchingRef.current) {
        return
      }
      runSearch(query)
    },
    [runSearch]
  )

  const startSearch = React.useCallback(() => {
    if (isSearchingRef.current) {
      return
    }
    isSearchingRef.current = true
    const next = makeInboxSearchInfo()
    searchInfoRef.current = next
    visibleResultCountsRef.current = getDefaultVisibleResultCounts(next)
    setIsSearching(true)
    setSearchInfo(next)
    runSearch('')
  }, [runSearch])

  React.useEffect(() => {
    clearSearch()
    return () => {
      clearSearch()
    }
  }, [clearSearch])

  React.useEffect(() => {
    if (mobileAppState === 'background' && isSearchingRef.current) {
      clearSearch()
    }
  }, [clearSearch, mobileAppState])

  return React.useMemo(
    () => ({
      cancelSearch,
      isSearching,
      moveSelectedIndex,
      query: searchInfo.query,
      searchInfo,
      selectResult,
      setQuery,
      setVisibleResultCounts,
      startSearch,
    }),
    [
      cancelSearch,
      isSearching,
      moveSelectedIndex,
      searchInfo,
      selectResult,
      setQuery,
      setVisibleResultCounts,
      startSearch,
    ]
  )
}
