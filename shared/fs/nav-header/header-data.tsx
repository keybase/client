import type * as React from 'react'
import type * as T from '@/constants/types'
import * as Kbfs from '../common'
import * as FS from '@/constants/fs'

const Coordinator = ({path}: {path: T.FS.Path}) => {
  Kbfs.useFsScreenCoordinator(path)
  return null
}

// A screen's header draws outside the screen's own data, so it keeps one copy of its own: every
// piece of the header (title, sync status, actions) reads it, and it loads and stays subscribed to
// what they show. The Files root's header shows nothing from it.
const FsHeaderData = ({children, path, seed}: {children: React.ReactNode; path: T.FS.Path; seed?: Kbfs.FsDataSeed}) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider {...seed}>
      {path !== FS.defaultPath && <Coordinator path={path} />}
      {children}
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default FsHeaderData
