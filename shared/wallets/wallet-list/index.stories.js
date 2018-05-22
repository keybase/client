// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import {Wallet, AddWallet} from '.'

const common = {
  isSelected: false,
  name: '',
  keybaseUser: '',
  contents: '',
  onSelect: action('onSelect'),
}

const mocks = [
  {
    ...common,
    keybaseUser: 'cecileb',
    isSelected: true,
    name: "cecileb's wallet",
    contents: '280.0871234 XLM + more',
  },
  {
    ...common,
    name: 'Second wallet',
    contents: '56.9618203 XLM',
  },
]

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const load = () => {
  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Wallet List', () => (
      <Box style={{width: 240}}>
        {mocks.map(m => <Wallet key={m.name} {...m} />)}
        <AddWallet
          showingMenu={true}
          onAddNew={action('onAddNew')}
          onLinkExisting={action('onAddExisting')}
        />
      </Box>
    ))
}

export default load
