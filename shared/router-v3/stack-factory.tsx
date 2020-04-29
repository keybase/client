import {createStackNavigator} from '@react-navigation/stack'
import {ParamList, ModalParamList} from './types'
/** Our common stack. We use this on all the tabs and it allows all the screens */
export const Stack = createStackNavigator<ParamList>()

/** The modal stack on top of the tabs */
export const ModalStack = createStackNavigator<ModalParamList>()
