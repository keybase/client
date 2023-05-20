import * as React from 'react'
import type * as Container from '../../util/container'

const Channel = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Channel>

const getOptions = () => ({
  headerHideBorder: true,
  headerTitle: '',
  underNotch: true,
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Channel {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
