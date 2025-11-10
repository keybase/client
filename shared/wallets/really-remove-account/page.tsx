import * as React from 'react'
import type * as C from '@/constants'

const ReallyRemove = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof ReallyRemove>

export default {screen: (p: OwnProps) => <ReallyRemove {...p.route.params} />}
