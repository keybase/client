import * as React from 'react'
import * as C from '../../constants'

const Pdf = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Pdf>

const getOptions = () => (C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'})

const Screen = (p: OwnProps) => (
  <C.ProviderScreen rp={p}>
    <Pdf {...p.route.params} />
  </C.ProviderScreen>
)

export default {getOptions, getScreen: () => Screen}
