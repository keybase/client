import {openURL} from '@/util/misc'
import KB2 from '@/util/electron.desktop'
const {showContextMenu} = KB2.functions

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  return {
    onClick: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      openURL(url)
    },
    onContextMenu: (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      showContextMenu?.(url)
    },
  } as const
}
