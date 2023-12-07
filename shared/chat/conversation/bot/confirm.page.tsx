import * as C from '@/constants'
import * as React from 'react'

const Confirm = React.lazy(async () => import('./confirm'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Confirm>>

const Screen = (p: OwnProps) => {
  const rest = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Confirm {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
