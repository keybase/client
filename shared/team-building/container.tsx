import type * as TeamBuildingTypes from '../constants/types/team-building'
import TeamBuilding from '.'
export default TeamBuilding

export type TeamBuilderProps = Partial<{
  namespace: TeamBuildingTypes.AllowedNamespace
  teamID: string
  filterServices: Array<TeamBuildingTypes.ServiceIdWithContact>
  goButtonLabel: TeamBuildingTypes.GoButtonLabel
  title: string
  recommendedHideYourself?: boolean
}>
