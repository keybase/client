import type {NavState} from '@/constants/router'
import type {ParamListBase} from '@react-navigation/native'
import type {NavigationContainerRef} from '@react-navigation/core'

type SubnavNavigation = Pick<NavigationContainerRef<ParamListBase>, 'dispatch' | 'emit'>

export type useSubnavTabAction = (navigation: SubnavNavigation, state: NavState) => (t: string) => void
