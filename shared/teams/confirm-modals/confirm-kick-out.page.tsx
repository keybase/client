import * as React from 'react'
import type * as C from '@/constants'

const Kick = React.lazy(async () => import('./confirm-kick-out'))
type OwnProps = C.ViewPropsToPageProps<typeof Kick>

export default {screen: (p: OwnProps) => <Kick {...p.route.params} />}
