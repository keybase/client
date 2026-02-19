import openURL from '@/util/open-url'
import * as Clipboard from 'expo-clipboard'
import {Alert} from 'react-native'

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  return {
    onClick: () => {
      openURL(url)
    },
    onLongPress: () => {
      Alert.alert('', url, [
        {onPress: () => openURL(url), text: 'Open'},
        {onPress: () => { void Clipboard.setStringAsync(url) }, text: 'Copy'},
        {text: 'Cancel'},
      ])
    },
  } as const
}
