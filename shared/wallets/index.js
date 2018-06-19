// @flow
import * as React from 'react'
import {Box2, WaitingButton} from '../common-adapters'

type Props = {
  refresh: () => void,
  waitingKey: string,
}

const Wallets = ({refresh, waitingKey}: Props) => (
  <Box2 direction="vertical" fullHeight={true} gap="xlarge" gapStart={true} gapEnd={true}>
    <WaitingButton type="Primary" label="Refresh wallets" onClick={refresh} waitingKey={waitingKey} />
  </Box2>
)

export default Wallets
