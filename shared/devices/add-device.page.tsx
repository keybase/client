import * as React from 'react'
import type * as C from '@/constants'

const Add = React.lazy(async () => import('./add-device'))
type OwnProps = C.ViewPropsToPageProps<typeof Add>

const Screen = (p: OwnProps) => <Add {...p.route.params} />

export default {screen: Screen}
