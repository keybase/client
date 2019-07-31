import * as React from 'react'
import {SectionList} from 'react-native'

// Desktop specific props. `selectedIndex` is used for SectionList with item
// selecting, where the scroll should follow selected item.
type DesktopProps = {
  selectedIndex: number | undefined
}

// This resolves to 'any'
// check https://facebook.github.io/react-native/docs/sectionlist#props for the time being
// TODO import the type from react-native
export type Props = React.ComponentProps<typeof SectionList> & DesktopProps

export default class extends React.Component<Props> {}
