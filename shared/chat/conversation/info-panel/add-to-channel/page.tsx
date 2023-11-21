import * as React from 'react'
import * as C from '../../../../constants'

const Add = React.lazy(async () => import('./index.new'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof Add>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <Add {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
