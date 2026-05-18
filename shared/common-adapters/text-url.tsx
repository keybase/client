import {openURL} from '@/util/misc'

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  if (isMobile) {
    const {Alert} = require('react-native') as typeof import('react-native')
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard')
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const {showContextMenu} = (require('@/util/electron.desktop') as any).default.functions as {
    showContextMenu?: (url: string) => void
  }
  return {
    onClick: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      void openURL(url)
    },
    onContextMenu: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      showContextMenu?.(url)
    },
  } as const
}
