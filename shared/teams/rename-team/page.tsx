import * as React from 'react'
import type * as C from '@/constants'

const Rename = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Rename>

export default {screen: (p: OwnProps) => <Rename {...p.route.params} />}
