import {useSharedValue, type SharedValue} from 'react-native-reanimated'
import type {Vector} from '../../types'

export const useVector = (x: number, y: number): Vector<SharedValue<number>> => {
  const first = useSharedValue<number>(x)
  const second = useSharedValue<number>(y)
  return {x: first, y: second}
}
