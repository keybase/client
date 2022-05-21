import type * as TeamBuildingTypes from '../constants/types/team-building'
declare const newRoutes: {}
declare const newModalRoutes: {}
export {newRoutes, newModalRoutes}

type TeamBuilderProps = Partial<{
  recommendedHideYourself?: boolean
  namespace: TeamBuildingTypes.AllowedNamespace
  teamID: string
  filterServices: Array<TeamBuildingTypes.ServiceIdWithContact>
  goButtonLabel: TeamBuildingTypes.GoButtonLabel
  title: string
}>
export type RootParamListCrypto = {
  cryptoRoot: undefined
  cryptoTeamBuilder: TeamBuilderProps
  encryptTab: undefined
  decryptTab: undefined
  signTab: undefined
  verifyTab: undefined
  encryptOutput: undefined
  decryptOutput: undefined
  signOutput: undefined
  verifyOutput: undefined
}
