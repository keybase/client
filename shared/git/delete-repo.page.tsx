import * as React from 'react'
import type * as C from '@/constants'

const Delete = React.lazy(async () => import('./delete-repo'))
type OwnProps = C.ViewPropsToPageProps<typeof Delete>

export default {screen: (p: OwnProps) => <Delete {...p.route.params} />}
