// @flow
import * as React from 'react'
import {Box2, Button} from '../common-adapters'

type Props = {
  refresh: () => void,
}

const Wallets = ({hello, refresh}: Props) => (
  <Box2 direction="vertical" fullHeight={true} gap="xlarge" gapStart={true} gapEnd={true}>
    <Button type="Primary" label="Refresh wallets" onClick={refresh} />
  </Box2>
)

export default Wallets
