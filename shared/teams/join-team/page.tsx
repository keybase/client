import * as React from 'react'
import type * as C from '@/constants'

const Join = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Join>

const Screen = (p: OwnProps) => <Join {...p.route.params} />

export default {screen: Screen}
