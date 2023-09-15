import * as React from 'react'
import type * as C from '../../../constants'

const Index = React.lazy(async () => import('./index.new'))
type OwnProps = C.ViewPropsToPageProps<typeof Index>

const getOptions = () => ({
  headerHideBorder: true,
  headerTitle: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Index {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
