import * as React from 'react'
import type * as Container from '../../util/container'

const Team = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Team>

const getOptions = () => ({
  headerHideBorder: true,
  headerTitle: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Team {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
