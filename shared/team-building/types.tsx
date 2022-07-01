import {type TeamID} from '../constants/types/teams'
import type {
  AllowedNamespace,
  FollowingState,
  GoButtonLabel,
  SearchResults,
  SelectedUser,
  ServiceIdWithContact,
} from '../constants/types/team-building'

export type SearchResult = {
  contact: boolean
  userId: string
  username: string
  prettyName: string
  pictureUrl?: string
  displayLabel: string
  services: {[K in ServiceIdWithContact]?: string}
  inTeam: boolean
  isPreExistingTeamMember: boolean
  isYou: boolean
  followingState: FollowingState
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
  filterServices?: Array<ServiceIdWithContact>
  focusInputCounter: number
  goButtonLabel?: GoButtonLabel
  highlightedIndex: number
  namespace: AllowedNamespace
  onAdd: (userId: string) => void
  onChangeService: (newService: ServiceIdWithContact) => void
  onChangeText: (newText: string) => void
  onClear: () => void
  onClose: () => void
  onDownArrowKeyDown: () => void
  onEnterKeyDown: () => void
  onFinishTeamBuilding: () => void
  onRemove: (userId: string) => void
  onSearchForMore: (len: number) => void
  onUpArrowKeyDown: () => void
  recommendations: Array<SearchRecSection> | null
  search: (query: string, service: ServiceIdWithContact) => void
  searchResults: Array<SearchResult> | undefined
  searchString: string
  selectedService: ServiceIdWithContact
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showServiceResultCount: boolean
  teamBuildingSearchResults: SearchResults
  teamID: TeamID | undefined
  teamSoFar: Array<SelectedUser>
}

export type OnScrollProps = {
  onScroll: undefined | (() => void)
}
