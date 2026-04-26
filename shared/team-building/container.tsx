import type * as T from '@/constants/types'
import type {AddMembersWizard} from '@/teams/add-members-wizard/state'
import TeamBuilding from '.'
export default TeamBuilding

type RouteParams = {
  addMembersWizard?: AddMembersWizard | undefined
  namespace: T.TB.AllowedNamespace
  teamID?: string | undefined
  filterServices?: Array<T.TB.ServiceIdWithContact> | undefined
  goButtonLabel?: T.TB.GoButtonLabel | undefined
  title?: string | undefined
  recommendedHideYourself?: boolean | undefined
}

export type TeamBuilderRouteParams = RouteParams

export type TeamBuilderProps = RouteParams & {
  onFinishTeamBuilding?: (() => void) | undefined
}
