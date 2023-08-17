import type * as T from '../constants/types'

export type SearchResult = {
  contact: boolean
  userId: string
  username: string
  prettyName: string
  pictureUrl?: string
  displayLabel: string
  services: {[K in T.TB.ServiceIdWithContact]?: string}
  inTeam: boolean
  isPreExistingTeamMember: boolean
  isYou: boolean
  followingState: T.TB.FollowingState
  isImportButton?: false
  isSearchHint?: false
}

export type ImportContactsEntry = {
  isImportButton: true
  isSearchHint?: false
}

export type SearchHintEntry = {
  isImportButton?: false
  isSearchHint: true
}

export type ResultData = SearchResult | ImportContactsEntry | SearchHintEntry

export type SearchRecSection = {
  label: string
  shortcut: boolean
  data: Array<ResultData>
}

export type Props = {
  error?: string
  filterServices?: Array<T.TB.ServiceIdWithContact>
  focusInputCounter: number
  goButtonLabel?: T.TB.GoButtonLabel
  highlightedIndex: number
  namespace: T.TB.AllowedNamespace
  onAdd: (userId: string) => void
  onChangeService: (newService: T.TB.ServiceIdWithContact) => void
  onChangeText: (newText: string) => void
  onClear: () => void
  onClose: () => void
  onDownArrowKeyDown: () => void
  onEnterKeyDown: () => void
  onFinishTeamBuilding: () => void
  onRemove: (userId: string) => void
  onSearchForMore: (len: number) => void
  onUpArrowKeyDown: () => void
  recommendations?: Array<SearchRecSection>
  search: (query: string, service: T.TB.ServiceIdWithContact) => void
  searchResults: Array<SearchResult> | undefined
  searchString: string
  selectedService: T.TB.ServiceIdWithContact
  serviceResultCount: {[K in T.TB.ServiceIdWithContact]?: number | undefined}
  showServiceResultCount: boolean
  teamBuildingSearchResults: T.TB.SearchResults
  teamID: T.Teams.TeamID | undefined
  teamSoFar: Array<T.TB.SelectedUser>
}

export type OnScrollProps = {
  onScroll: undefined | (() => void)
}
