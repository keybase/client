import * as React from 'react'
import * as C from '../../../constants'

const Search = React.lazy(async () => import('./search'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Search>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Search {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
