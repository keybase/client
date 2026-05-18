import {openURL} from '@/util/misc'
import type {AlertStatic} from 'react-native'

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  if (isMobile) {
    const {Alert} = require('react-native') as {Alert: AlertStatic}
    const {setStringAsync} = require('expo-clipboard') as {
      setStringAsync: (text: string) => Promise<boolean>
    }
    return {
      onClick: () => {
        void openURL(url)
      },
      onLongPress: () => {
        Alert.alert('', url, [
          {onPress: () => { void openURL(url) }, text: 'Open'},
          {onPress: () => { void setStringAsync(url) }, text: 'Copy'},
          {text: 'Cancel'},
        ])
      },
    } as const
  }
  const {default: {functions: {showContextMenu}}} = require('@/util/electron') as {
    default: {functions: {showContextMenu?: (url: string) => void}}
  }
  return {
    onClick: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      void Promise.resolve(openURL(url))
    },
    onContextMenu: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      showContextMenu?.(url)
    },
  } as const
}
