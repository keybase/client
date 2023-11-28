import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  visible: boolean
  onHidden: () => void
  onSelect: (mediaType: 'photo' | 'video' | 'mixed', location: 'camera' | 'library') => void
}

export declare const FilePickerPopup: (p: Props) => React.ReactNode
export default FilePickerPopup
