import * as React from 'react'
import type * as C from '@/constants'

const Ext = React.lazy(async () => import('./external-team'))
type OwnProps = C.ViewPropsToPageProps<typeof Ext>

const Screen = (p: OwnProps) => <Ext {...p.route.params} />

export default {
  getOptions: {
    header: undefined,
    headerBottomStyle: {height: undefined},
    headerShadowVisible: false,
    title: ' ', // hack: trick router shim so it doesn't add a safe area around us
  },
  screen: Screen,
}
