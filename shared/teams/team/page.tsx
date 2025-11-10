import * as React from 'react'
import type * as C from '@/constants'

const Team = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Team>

export default {
  getOptions: {
    headerShadowVisible: false,
    headerTitle: '',
  },
  screen: (p: OwnProps) => <Team {...p.route.params} />,
}
