import * as React from 'react'
import type {StaticScreenProps} from '@react-navigation/core'

const Contact = React.lazy(async () => import('./contact-restricted'))
type OwnProps = StaticScreenProps<React.ComponentProps<typeof Contact>>

const Screen = (p: OwnProps) => <Contact {...p.route.params} />

export default {screen: Screen}
