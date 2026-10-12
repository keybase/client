import * as React from 'react'
import type {StaticScreenProps} from '@react-navigation/core'

const Contact = React.lazy(async () => import('./contact-restricted'))
type OwnProps = StaticScreenProps<React.ComponentProps<typeof Contact>>

const Screen = (p: OwnProps) => <Contact {...p.route.params} />

export default {
  getOptions: ({route}: OwnProps) => ({
    title: route.params.source === 'newFolder' ? "Can't open folder" : "Can't add",
  }),
  screen: Screen,
}
