import * as React from 'react'
import * as Kb from '../../common-adapters'
import type {ImageViewProps as Props} from './image-view'

export default (p: Props) => <Kb.ZoomableImage src={p.url} />
