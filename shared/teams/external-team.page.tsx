import * as React from 'react'
import type * as Container from '../util/container'

const Ext = React.lazy(async () => import('./external-team'))
type OwnProps = Container.ViewPropsToPageProps<typeof Ext>

const getOptions = () => ({
  header: undefined,
  headerBottomStyle: {height: undefined},
  headerHideBorder: true,
  title: ' ', // hack: trick router shim so it doesn't add a safe area around us
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Ext {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
