import * as React from 'react'
import * as Container from '../../util/container'

const Pdf = React.lazy(async () => import('.'))
type OwnProps = Container.ViewPropsToPageProps<typeof Pdf>

const getOptions = () => (Container.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Pdf {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
