import type * as T from '@/constants/types'
import TeamBuilding from '.'
export default TeamBuilding

type RouteParams = {
  namespace: T.TB.AllowedNamespace
  teamID?: string
  filterServices?: Array<T.TB.ServiceIdWithContact>
  goButtonLabel?: T.TB.GoButtonLabel
  title?: string
  recommendedHideYourself?: boolean
}

export type TeamBuilderRouteParams = RouteParams

export type TeamBuilderProps = RouteParams & {
  onFinishTeamBuilding?: () => void
}
