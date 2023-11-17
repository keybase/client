import * as React from 'react'
import * as C from '../../constants'

const Pdf = React.lazy(async () => import('.'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Pdf>>

const getOptions = () => (C.isMobile ? undefined : {modal2: true, modal2Type: 'SuperWide'})

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Pdf {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getOptions, getScreen: () => Screen}
export default Page
