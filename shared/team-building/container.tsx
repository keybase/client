import type * as T from '@/constants/types'
import type {AddMembersWizard} from '@/teams/add-members-wizard/state'
import TeamBuilding from '.'
export default TeamBuilding

type RouteParams = {
  addMembersWizard?: AddMembersWizard
  namespace: T.TB.AllowedNamespace
  teamID?: string
  filterServices?: Array<T.TB.ServiceIdWithContact>
  goButtonLabel?: T.TB.GoButtonLabel
  // entry context, e.g. an error from a failed add-members attempt that reopened this screen
  initialError?: string
  title?: string
  recommendedHideYourself?: boolean
}

export type TeamBuilderRouteParams = RouteParams

export type TeamBuilderProps = RouteParams & {
  onFinishTeamBuilding?: () => void
}
