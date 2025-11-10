import * as React from 'react'
import type * as C from '@/constants'

const Remove = React.lazy(async () => import('./confirm-remove-from-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof Remove>

export default {screen: (p: OwnProps) => <Remove {...p.route.params} />}
