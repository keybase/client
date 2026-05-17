import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import {useNavigation} from '@react-navigation/native'
import {useIsFocused} from '@react-navigation/core'
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs'
import {isLiquidGlassSupported as _isLiquidGlassSupported} from '@callstack/liquid-glass'
import type {RootParamList} from '@/router-v2/route-params'

const isLiquidGlassActive = (C.isIOS && C.isPhone && _isLiquidGlassSupported) as boolean

export const BottomAccessory = ({children}: {children: React.ReactNode}) => {
  const navigation = useNavigation()
  const isFocused = useIsFocused()

  React.useEffect(() => {
    if (!Styles.isMobile || !isLiquidGlassActive || !isFocused) return
    const parent = navigation.getParent() as BottomTabNavigationProp<RootParamList> | undefined
    parent?.setOptions({bottomAccessory: (): React.ReactNode => children})
    return () => {
      parent?.setOptions({bottomAccessory: undefined})
    }
  }, [children, isFocused, navigation])

  if (!Styles.isMobile || !isLiquidGlassActive) return <>{children}</>
  return null
}
