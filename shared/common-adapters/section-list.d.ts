import * as React from 'react'
import {SectionList, SectionListRenderItem as _SectionListRenderItem} from 'react-native'

export type Props = React.ComponentProps<typeof SectionList>
export type SectionListRenderItem<T> = _SectionListRenderItem<T>

export default class extends React.Component<Props> {}
