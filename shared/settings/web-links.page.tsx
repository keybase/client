import * as React from 'react'
import type * as C from '@/constants'

type OwnProps = C.ViewPropsToPageProps<typeof Web>
const Web = React.lazy(async () => import('./web-links'))

const Page = {
  getOptions: ({route}: OwnProps) => ({
    header: undefined,
    title: route.params.title,
  }),
  screen: (p: OwnProps) => <Web {...p.route.params} />,
}
export default Page
