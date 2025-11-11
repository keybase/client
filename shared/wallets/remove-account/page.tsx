import * as React from 'react'
import type * as C from '@/constants'

const Remove = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Remove>

const Screen = (p: OwnProps) => <Remove {...p.route.params} />

export default {screen: Screen}
