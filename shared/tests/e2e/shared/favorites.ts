// The smoke+second private folder's place in the smoke account's favorites, read and restored through
// the main service. Blocking the second account ignores the folder, and unblocking leaves it
// ignored, so a flow that blocks puts it back. Framework-free: shared by the desktop and iOS flows.
import {loadE2EAccounts} from '../accounts/env.ts'
import {mainRpc} from './main-rpc.ts'

export const pairFolder = () => {
  const {smokeUser, secondUser} = loadE2EAccounts()
  return `/keybase/private/${[smokeUser, secondUser].sort().join(',')}`
}

type FavoriteFolder = {name: string; folderType: number}
const privateFolderType = 1
const pairName = () => pairFolder().slice(pairFolder().lastIndexOf('/') + 1)

export type PairFavoriteState = {favorite: boolean; ignored: boolean}

// Whether the smoke+second folder is in the smoke account's favorites or its ignored folders.
export const pairFavoriteState = async (): Promise<PairFavoriteState> => {
  const res = await mainRpc<{favoriteFolders: Array<FavoriteFolder> | null; ignoredFolders: Array<FavoriteFolder> | null}>(
    'keybase.1.favorite.getFavorites',
    {}
  )
  const has = (list: Array<FavoriteFolder> | null) => !!list?.some(f => f.name === pairName() && f.folderType === privateFolderType)
  return {favorite: has(res.favoriteFolders), ignored: has(res.ignoredFolders)}
}

const REFAVORITE_MS = 20_000
const POLL_MS = [100, 250, 500, 1_000]

// Makes the smoke+second folder a favorite again (it was one before the flow), and reads that back
// until the service shows it, failing after REFAVORITE_MS with the last state read.
export const refavoritePair = async () => {
  await mainRpc('keybase.1.favorite.favoriteAdd', {folder: {created: false, folderType: privateFolderType, name: pairName()}})
  const deadline = Date.now() + REFAVORITE_MS
  for (let i = 0; ; i++) {
    const now = await pairFavoriteState()
    if (now.favorite && !now.ignored) return
    if (Date.now() > deadline) {
      throw new Error(`the smoke+second folder after favoriteAdd: ${JSON.stringify(now)}, want a favorite, not ignored`)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS[Math.min(i, POLL_MS.length - 1)]))
  }
}
