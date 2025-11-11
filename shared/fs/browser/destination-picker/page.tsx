import * as React from 'react'
import type * as C from '@/constants'

const Picker = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Picker>

const Screen = (p: OwnProps) => <Picker {...p.route.params} />

export default {screen: Screen}
