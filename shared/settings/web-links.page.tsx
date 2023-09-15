import * as React from 'react'
import type * as C from '../constants'

const Web = React.lazy(async () => import('./web-links'))
type OwnProps = C.ViewPropsToPageProps<typeof Web>

const getOptions = ({route}: OwnProps) => ({
  header: undefined,
  title: route.params.title,
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Web {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
