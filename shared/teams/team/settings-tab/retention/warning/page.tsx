import * as React from 'react'
import type * as C from '@/constants'

const Warning = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Warning>

export default {screen: (p: OwnProps) => <Warning {...p.route.params} />}
