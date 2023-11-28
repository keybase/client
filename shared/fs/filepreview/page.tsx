import * as React from 'react'
import type * as C from '@/constants'

const BarePreview = React.lazy(async () => {
  const {BarePreview} = await import('.')
  return {default: BarePreview}
})

type OwnProps = C.ViewPropsToPageProps<typeof BarePreview>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <BarePreview {...p.route.params} />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
