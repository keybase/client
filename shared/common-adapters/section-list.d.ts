import * as React from 'react'
import {SectionList} from 'react-native'

// This resolves to 'any'
// check https://facebook.github.io/react-native/docs/sectionlist#props for the time being
// TODO import the type from react-native
export type Props = React.ComponentProps<typeof SectionList>

export default class extends React.Component<Props> {}
