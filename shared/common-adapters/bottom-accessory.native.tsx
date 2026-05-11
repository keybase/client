import * as C from '@/constants'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import {useIsFocused} from '@react-navigation/core'
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs'
import {isLiquidGlassSupported as _isLiquidGlassSupported} from '@callstack/liquid-glass'
import type {RootParamList} from '@/router-v2/route-params'

const isLiquidGlassActive = (C.isIOS && C.isPhone && _isLiquidGlassSupported) as boolean

export const BottomAccessory = ({children}: {children: React.ReactNode}) => {
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const childrenRef = React.useRef<React.ReactNode>(children)
  childrenRef.current = children

  const renderFn = React.useCallback(() => childrenRef.current, [])

  React.useEffect(() => {
    if (!isLiquidGlassActive || !isFocused) return
    const parent = navigation.getParent() as BottomTabNavigationProp<RootParamList> | undefined
    parent?.setOptions({bottomAccessory: renderFn})
    return () => {
      parent?.setOptions({bottomAccessory: undefined})
    }
  }, [isFocused, navigation, renderFn])

  if (isLiquidGlassActive) return null
  return <>{children}</>
}
