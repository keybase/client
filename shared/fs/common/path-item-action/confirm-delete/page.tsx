import * as React from 'react'
import type * as C from '@/constants'

const Confirm = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Confirm>

export default {
  screen: (p: OwnProps) => <Confirm {...p.route.params} />,
}
