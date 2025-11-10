import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as C from '@/constants'
import Header from './inbox-and-conversation-header'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

const Split = React.lazy(async () => import('./inbox-and-conversation-2'))
type OwnProps = C.ViewPropsToPagePropsMaybe<typeof Split>

const getOptions = Kb.Styles.isTablet
  ? {
      headerBackgroundContainerStyle: {},
      headerLeft: null,
      headerLeftContainerStyle: {maxWidth: 0},
      headerRight: null,
      headerRightContainerStyle: {maxWidth: 0},
      headerStyle: {},
      headerTitle: () => <TabletHeader />,
      headerTitleContainerStyle: {},
    }
  : {
      headerTitle: () => {
        return <Header />
      },
    }

const TabletHeader = React.memo(function TabletHeader() {
  const {width} = useSafeAreaFrame()
  return (
    <Kb.Box2
      direction="horizontal"
      // ios only allows centered so we do some margin to help spread it out
      style={{height: 48, marginLeft: -20, width}}
    >
      <Header />
    </Kb.Box2>
  )
})

const Page = {getOptions, screen: (p: OwnProps) => <Split {...p.route.params} />}
export default Page
