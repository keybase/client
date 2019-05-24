import * as React from 'react'
import {MessageExplodeDescription} from '../../../../constants/types/chat2'

export type Props = {
  attachTo: () => React.ElementRef<any> | null
  visible: boolean
  onHidden: () => void
  selected: number
  onSelect: (arg0: number) => void
  items: MessageExplodeDescription[]
}
