import * as React from 'react'
import type * as C from '@/constants'

const EditAvatar = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof EditAvatar>
export default {
  screen: (p: OwnProps) => <EditAvatar {...p.route.params} />,
}
