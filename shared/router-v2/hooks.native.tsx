import * as C from '@/constants'
import * as React from 'react'
import {useColorScheme} from 'react-native'

// on android we rerender everything on dark mode changes
export const useRootKey = () => {
  const [rootKey, setRootKey] = React.useState('')
  const isDarkMode = useColorScheme() === 'dark'
  React.useEffect(() => {
    if (!C.isAndroid) return
    setRootKey(isDarkMode ? 'android-dark' : 'android-light')
  }, [isDarkMode])

  return rootKey
}
