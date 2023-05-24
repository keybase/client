import * as React from 'react'
import * as Container from '../util/container'

const Web = React.lazy(async () => import('./web-links.native'))
type OwnProps = Container.ViewPropsToPageProps<typeof Web>

const getOptions = ({route}: OwnProps) => ({
  header: undefined,
  title: route.params.title,
})

const Screen = (p: OwnProps) =>
  Container.isMobile ? (
    <React.Suspense>
      <Web {...p.route.params} />
    </React.Suspense>
  ) : null

export default {getOptions, getScreen: () => Screen}
