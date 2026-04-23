import * as React from 'react'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'

type BrowserSortContextType = {
  setSortSetting: (path: T.FS.Path, sortSetting: T.FS.SortSetting) => void
  sortSettings: ReadonlyMap<T.FS.Path, T.FS.SortSetting>
}

const BrowserSortContext = React.createContext<BrowserSortContextType | null>(null)

const getDefaultSortSetting = (path: T.FS.Path) =>
  T.FS.getPathLevel(path) < 3 ? Constants.defaultTlfListPathUserSetting.sort : Constants.defaultPathUserSetting.sort

export const useFsBrowserSort = (path: T.FS.Path) => {
  const context = React.useContext(BrowserSortContext)
  return {
    setSortSetting: context?.setSortSetting ?? (() => {}),
    sortSetting: context?.sortSettings.get(path) ?? getDefaultSortSetting(path),
  }
}

export const FsBrowserSortProvider = ({children}: {children: React.ReactNode}) => {
  const [sortSettings, setSortSettings] = React.useState<ReadonlyMap<T.FS.Path, T.FS.SortSetting>>(
    () => new Map()
  )

  const setSortSetting = (path: T.FS.Path, sortSetting: T.FS.SortSetting) => {
    setSortSettings(prevSortSettings => {
      if (prevSortSettings.get(path) === sortSetting) {
        return prevSortSettings
      }
      const nextSortSettings = new Map(prevSortSettings)
      nextSortSettings.set(path, sortSetting)
      return nextSortSettings
    })
  }

  return (
    <BrowserSortContext.Provider value={{setSortSetting, sortSettings}}>
      {children}
    </BrowserSortContext.Provider>
  )
}
