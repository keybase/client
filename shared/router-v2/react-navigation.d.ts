import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {PrivateValueStore} from '@react-navigation/core'

declare module '@react-navigation/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends PrivateValueStore<[KBRootParamList, unknown, unknown]> {}
}

export {}
