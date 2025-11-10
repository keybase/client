import * as React from 'react'
import type * as C from '@/constants'

const Revoke = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Revoke>
export default {screen: (p: OwnProps) => <Revoke {...p.route.params} />}
