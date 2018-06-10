// @flow
import * as React from 'react'
import {Box2, Button, WaitingButton} from '../common-adapters'

type Props = {
  refresh: () => void,
}

const Wallets = ({hello, refresh}: Props) => (
  <Box2 direction="vertical" fullHeight={true} gap="xlarge" gapStart={true} gapEnd={true}>
    <WaitingButton type="Primary" label="Refresh wallets" onClick={refresh} waitingKey="foo" />
  </Box2>
)

export default Wallets
