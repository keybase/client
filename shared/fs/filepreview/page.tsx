import * as React from 'react'
import type * as Container from '../../util/container'

const BarePreview = React.lazy(async () => {
  const {BarePreview} = await import('.')
  return {default: BarePreview}
})

type OwnProps = Container.ViewPropsToPageProps<typeof BarePreview>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <BarePreview {...p.route.params} />
  </React.Suspense>
)

export default {getScreen: () => Screen}
