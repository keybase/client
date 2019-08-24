import * as React from 'react'

export type Props = {
  attachTo?: () => React.Component<any> | null
  visible: boolean
  onHidden: () => void
  onSelect: (mediaType: 'photo' | 'video' | 'mixed', location: 'camera' | 'library') => void
}
