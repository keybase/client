import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  visible: boolean
  onHidden: () => void
  onSelect: (mediaType: 'photo' | 'video' | 'mixed' | 'file', location: 'camera' | 'library' | 'file') => void
}
