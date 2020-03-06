import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
import OperationsList from '.'

const load = () => {
  Sb.storiesOf('Crypto/Operations List', module)
    .add('Select - Encrypt', () => <OperationsList routeSelected={Constants.encryptTab} />)
    .add('Select - Decrypt', () => <OperationsList routeSelected={Constants.decryptTab} />)
    .add('Select - Sign', () => <OperationsList routeSelected={Constants.signTab} />)
    .add('Select - Verify', () => <OperationsList routeSelected={Constants.verifyTab} />)
}

export default load
