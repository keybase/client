import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import {AccountPageHeader} from '../../common'

const Settings = React.lazy(async () => import('./container'))

const ConnectedHeader = () => {
  const name = Container.useSelector(state => {
    const accountID = Constants.getSelectedAccount(state)
    return Constants.getAccount(state, accountID).name
  })

  return <AccountPageHeader accountName={name} title="Settings" />
}

const getOptions = () => ({
  headerTitle: () => <ConnectedHeader />,
})

const Screen = () => (
  <React.Suspense>
    <Settings />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
