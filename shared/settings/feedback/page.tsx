import * as React from 'react'
import * as C from '@/constants'

const Feedback = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Feedback>

export default {
  getOptions: C.isMobile
    ? {
        headerShown: true,
        title: 'Feedback',
      }
    : {},
  screen: (p: OwnProps) => <Feedback {...p.route.params} />,
}
