import * as React from 'react'
import type * as C from '@/constants'

const Disable = React.lazy(async () => {
  const {DeleteModal} = await import('./confirm-delete')
  return {default: DeleteModal}
})

type OwnProps = C.ViewPropsToPageProps<typeof Disable>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Disable {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
