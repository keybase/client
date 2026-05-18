import {openURL} from '@/util/misc'
import {Alert} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import KB2 from '@/util/electron'

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  if (isMobile) {
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
  const {showContextMenu} = KB2.functions
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
