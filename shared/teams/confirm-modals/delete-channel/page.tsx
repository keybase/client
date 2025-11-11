import * as React from 'react'
import type * as C from '@/constants'

const DeleteChan = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof DeleteChan>

const Screen = (p: OwnProps) => <DeleteChan {...p.route.params} />

export default {screen: Screen}
