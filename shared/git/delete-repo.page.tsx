import * as React from 'react'
import type * as C from '@/constants'

const Delete = React.lazy(async () => import('./delete-repo'))
type OwnProps = C.ViewPropsToPageProps<typeof Delete>

const Screen = (p: OwnProps) => <Delete {...p.route.params} />

export default {screen: Screen}
