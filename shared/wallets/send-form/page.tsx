import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'

const Send = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Send>

const getOptions = () => ({
  safeAreaStyle: {
    backgroundColor: Styles.globalColors.purpleDark,
  },
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Send {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
