import * as React from 'react'
import * as C from '../constants'

const New = React.lazy(async () => import('./new-team-dialog-container'))
type OwnProps = C.ChatProviderProps<C.ViewPropsToPageProps<typeof New>>

const Screen = (p: OwnProps) => {
  const {conversationIDKey, ...rest} = p.route.params
  return (
    <C.ProviderScreen rp={p}>
      <New {...rest} />
    </C.ProviderScreen>
  )
}

const Page = {getScreen: () => Screen}
export default Page
