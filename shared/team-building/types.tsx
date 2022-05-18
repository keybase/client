import {type TeamRoleType, type TeamID} from '../constants/types/teams'
import type {Section} from '../common-adapters/section-list'
import type * as Kb from '../common-adapters'
import type {Props as OriginalRolePickerProps} from '../teams/role-picker'
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

export type RolePickerProps = {
  onSelectRole: (role: TeamRoleType) => void
  sendNotification: boolean
  changeSendNotification: (sendNotification: boolean) => void
  showRolePicker: boolean
  changeShowRolePicker: (showRolePicker: boolean) => void
  selectedRole: TeamRoleType
  disabledRoles: OriginalRolePickerProps<false>['disabledRoles']
}

export type Props = {
  error?: string
  filterServices?: Array<ServiceIdWithContact>
  focusInputCounter: number
  goButtonLabel?: GoButtonLabel
  recommendedHideYourself?: boolean
  highlightedIndex: number | null
  includeContacts: boolean
  namespace: AllowedNamespace
  onAdd: (userId: string) => void
  onChangeService: (newService: ServiceIdWithContact) => void
  onChangeText: (newText: string) => void
  onClear: () => void
  onClose: () => void
  onDownArrowKeyDown: () => void
  onEnterKeyDown: () => void
  onFinishTeamBuilding: () => void
  onMakeItATeam: () => void
  onRemove: (userId: string) => void
  onSearchForMore: () => void
  onUpArrowKeyDown: () => void
  recommendations: Array<SearchRecSection> | null
  rolePickerProps?: RolePickerProps
  selectedService: ServiceIdWithContact
  search: (query: string, service: ServiceIdWithContact) => void
  searchResults: Array<SearchResult> | undefined
  searchString: string
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showRecs: boolean
  showResults: boolean
  showServiceResultCount: boolean
  teamBuildingSearchResults: SearchResults
  teamID: TeamID | undefined
  teamSoFar: Array<SelectedUser>
  teamname: string | undefined
  title: string
  waitingForCreate: boolean
}

export type SectionListProp = {
  sectionListRef: React.RefObject<Kb.SectionList<Section<ResultData, SearchRecSection>>>
}

export type OnScrollProps = {
  onScroll: undefined | (() => void)
}
