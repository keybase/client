import * as React from 'react'
import type * as C from '@/constants'

const BarePreview = React.lazy(async () => {
  const {BarePreview} = await import('.')
  return {default: BarePreview}
})

type OwnProps = C.ViewPropsToPageProps<typeof BarePreview>

const Page = {
  screen: (p: OwnProps) => <BarePreview {...p.route.params} />,
}
export default Page
