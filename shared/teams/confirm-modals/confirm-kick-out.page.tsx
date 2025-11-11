import * as React from 'react'
import type * as C from '@/constants'

const Kick = React.lazy(async () => import('./confirm-kick-out'))
type OwnProps = C.ViewPropsToPageProps<typeof Kick>

const Screen = (p: OwnProps) => <Kick {...p.route.params} />

export default {screen: Screen}
