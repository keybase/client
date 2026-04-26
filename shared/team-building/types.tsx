import type * as T from '@/constants/types'

export type SearchResult = {
  contact: boolean
  userId: string
  username: string
  prettyName: string
  pictureUrl?: string | undefined
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
