import * as React from 'react'
import type * as C from '@/constants'

const Web = React.lazy(async () => import('./web-links'))
type OwnProps = C.ViewPropsToPageProps<typeof Web>

export default {
  getOptions: ({route}: OwnProps) => ({
    header: undefined,
    title: route.params.title,
  }),
  screen: (p: OwnProps) => <Web {...p.route.params} />,
}
