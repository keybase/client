import * as React from 'react'
import * as Kb from '@/common-adapters'
import {HeaderNewChatButton} from './new-chat-button'
import {useHeaderHeight} from '@react-navigation/elements'

const Header = () => {
  const height = useHeaderHeight()
  const {top: paddingTop} = Kb.useSafeAreaInsets()
  return (
    <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.container, {height, paddingTop}])}>
      <Kb.Text type="BodyBig" center={true} style={{}}>
        Chats
      </Kb.Text>

      <Kb.Box2 direction="vertical" style={styles.buttonContainer}>
        <HeaderNewChatButton />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonContainer: {
    height: 36,
    position: 'absolute',
    right: 8,
    top: 22,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
}))

const getOptions = {
  freezeOnBlur: false, // let it render even if not visible
  header: () => <Header />,
}

const Defer = React.lazy(async () => import('./defer-loading'))
const Screen = () => (
  <React.Suspense>
    <Defer />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
