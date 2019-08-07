import * as React from 'react'
// import {SectionList, SectionListRenderItem as _SectionListRenderItem} from 'react-native'
// TODO this typing is currently very busted.
// Desktop specific props. `selectedIndex` is used for SectionList with item
// selecting, where the scroll should follow selected item.
type DesktopProps = {
  selectedIndex: number | undefined
}

// This resolves to 'any'
// check https://facebook.github.io/react-native/docs/sectionlist#props for the time being
// TODO import the type from react-native
export type Props = any & DesktopProps // React.ComponentProps<typeof SectionList>
// export type SectionListRenderItem<T> = _SectionListRenderItem<T>

export default class extends React.Component<Props> {}
