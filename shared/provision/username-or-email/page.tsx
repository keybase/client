import * as React from 'react'
import type * as C from '@/constants'

const UOE = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof UOE>

export default {screen: (p: OwnProps) => <UOE {...p.route.params} />}
