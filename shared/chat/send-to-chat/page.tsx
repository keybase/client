import * as React from 'react'
import type * as C from '@/constants'

const Send = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Send>

export default {screen: (p: OwnProps) => <Send {...p.route.params} />}
