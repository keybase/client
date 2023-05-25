import * as React from 'react'
import * as Container from '../../util/container'

const Feedback = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Feedback>

const getOptions = () =>
  Container.isMobile
    ? {
        headerShown: true,
        title: 'Feedback',
      }
    : {}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Feedback {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
