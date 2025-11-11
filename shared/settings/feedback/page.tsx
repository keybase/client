import * as React from 'react'
import * as C from '@/constants'

const Feedback = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Feedback>

const Screen = (p: OwnProps) => <Feedback {...p.route.params} />

export default {
  getOptions: C.isMobile
    ? {
        headerShown: true,
        title: 'Feedback',
      }
    : {},
  screen: Screen,
}
