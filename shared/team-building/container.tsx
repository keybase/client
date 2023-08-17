import type * as T from '../constants/types'
import TeamBuilding from '.'
export default TeamBuilding

export type TeamBuilderProps = Partial<{
  namespace: T.TB.AllowedNamespace
  teamID?: string
  filterServices?: Array<T.TB.ServiceIdWithContact>
  goButtonLabel?: T.TB.GoButtonLabel
  title: string
  recommendedHideYourself?: boolean
}>
