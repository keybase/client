import * as React from 'react'
import type * as C from '@/constants'

const DeleteChan = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof DeleteChan>

export default {screen: (p: OwnProps) => <DeleteChan {...p.route.params} />}
