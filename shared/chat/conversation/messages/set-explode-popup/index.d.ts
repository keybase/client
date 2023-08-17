import * as React from 'react'
import type * as T from '../../../../constants/types'

export type Props = {
  attachTo?: () => React.Component<any> | null
  visible: boolean
  onHidden: () => void
  selected: number
  onSelect: (arg0: number) => void
  items: T.Chat.MessageExplodeDescription[]
}
export declare class SetExplodingPopup extends React.Component<Props> {}
export default SetExplodingPopup
