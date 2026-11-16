import type * as React from 'react'
import type * as T from '@/constants/types'
import * as Kbfs from '../common'
import * as FS from '@/constants/fs'

// No header piece draws the folder's listing (the actions menu loads it when opened), so the header
// loads only the path's stat and the favorites
const Coordinator = ({path}: {path: T.FS.Path}) => {
  Kbfs.useFsScreenCoordinator(path, {children: false})
  return null
}

// A screen's header draws outside the screen's own data, so it keeps one copy of its own, which
// every header piece drawn inside it reads (on iOS that is only the title: the menu is attached from
// the screen). At the Files root nothing in the header needs a load, so none runs there.
const FsHeaderData = ({children, path, seed}: {children: React.ReactNode; path: T.FS.Path; seed?: Kbfs.FsDataSeed}) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider {...seed}>
      {path !== FS.defaultPath && <Coordinator path={path} />}
      {children}
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default FsHeaderData
