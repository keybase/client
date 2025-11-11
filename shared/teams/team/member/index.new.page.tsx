import * as React from 'react'
import type * as C from '@/constants'

const Index = React.lazy(async () => import('./index.new'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>

const Screen = (p: OwnProps) => <Index {...p.route.params} />

export default {
  getOptions: {
    headerShadowVisible: false,
    headerTitle: '',
  },
  screen: Screen,
}
