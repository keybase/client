import type * as React from 'react'
import type * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

export type FloatingMenuProps = {
  containerStyle?: Kb.Styles.StylesCrossPlatform
  hide: () => void
  visible: boolean
  attachTo?: React.RefObject<Kb.MeasureRef | null>
}

export type OnDownloadStarted = (
  downloadID: string,
  downloadIntent?: T.FS.DownloadIntent
) => void
