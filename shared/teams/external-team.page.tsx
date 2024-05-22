import * as React from 'react'
import type * as C from '@/constants'

const getOptions = {
  header: undefined,
  headerBottomStyle: {height: undefined},
  headerShadowVisible: false,
  title: ' ', // hack: trick router shim so it doesn't add a safe area around us
}

const Ext = React.lazy(async () => import('./external-team'))
type OwnProps = C.ViewPropsToPageProps<typeof Ext>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Ext {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
