import {Component} from 'react'
import {OverlayParentProps} from '../../../../common-adapters'
import {PlatformInputProps} from './types'
import {PropsWithSuggestor, PropsWithSuggestorOuter} from '../suggestors'

export type PlatformInputPropsInternal = PropsWithSuggestor<{} & PlatformInputProps & OverlayParentProps>

export default class PlatformInput extends Component<PropsWithSuggestorOuter<PlatformInputProps>> {}
