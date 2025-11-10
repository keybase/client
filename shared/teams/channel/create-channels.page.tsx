import * as React from 'react'
import type * as C from '@/constants'

const CreateChan = React.lazy(async () => import('./create-channels'))
type OwnProps = C.ViewPropsToPageProps<typeof CreateChan>

export default {screen: (p: OwnProps) => <CreateChan {...p.route.params} />}
