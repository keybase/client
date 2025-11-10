import * as React from 'react'
import type * as C from '@/constants'

const New = React.lazy(async () => import('./new-repo'))
type OwnProps = C.ViewPropsToPageProps<typeof New>

export default {screen: (p: OwnProps) => <New {...p.route.params} />}
