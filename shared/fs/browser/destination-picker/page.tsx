import * as React from 'react'
import type * as C from '@/constants'

const Picker = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Picker>

export default {
  screen: (p: OwnProps) => <Picker {...p.route.params} />,
}
