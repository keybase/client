import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  src: string
  style?: any
  onDragStart?: (e: React.SyntheticEvent) => void
  draggable?: boolean
  onLoad?: (e: React.BaseSyntheticEvent) => void
  onError?: () => void
  showLoadingStateUntilLoaded?: boolean
}

export type ReqProps = {
  src: any
  style?: StylesCrossPlatform | null
}

export default class Image extends React.Component<Props> {}
// Can accept require()
export class RequireImage extends React.Component<ReqProps> {}
