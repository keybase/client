import type {RootParamList as KBRootParamList} from './route-params'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends KBRootParamList {}
  }
}

export {}
