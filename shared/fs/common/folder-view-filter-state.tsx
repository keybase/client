import * as Z from '@/util/zustand'

// Bridges the folder view filter between the navigation header (where it's
// edited) and the browser list (where it's applied); those mount in separate
// trees so this can't live in either component.
type Store = {
  folderViewFilter: string | undefined
}

const initialStore: Store = {
  folderViewFilter: undefined,
}

export type State = Store & {
  dispatch: {
    resetState: () => void
    setFolderViewFilter: (folderViewFilter?: string) => void
  }
}

export const useFolderViewFilterState = Z.createZustand<State>('fs-folder-view-filter', set => {
  const dispatch: State['dispatch'] = {
    resetState: Z.defaultReset,
    setFolderViewFilter: folderViewFilter => {
      set(s => {
        s.folderViewFilter = folderViewFilter
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
