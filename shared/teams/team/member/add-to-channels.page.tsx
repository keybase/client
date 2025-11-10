import * as React from 'react'
import type * as C from '@/constants'

const AddToChan = React.lazy(async () => import('./add-to-channels'))
type OwnProps = C.ViewPropsToPageProps<typeof AddToChan>

export default {screen: (p: OwnProps) => <AddToChan {...p.route.params} />}
