// @flow
import * as React from 'react'
import Error from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {convertToRPCError} from '../../../util/errors'
import {constantsStatusCode} from '../../../constants/types/rpc-gen'

const props = {
  error: convertToRPCError({
    code: 901,
    desc:
      "You don't have a public key; try `keybase pgp select` or `keybase pgp import` if you have a key; or `keybase pgp gen` if you don't",
  }),
  onBack: action('onBack'),
}

const load = () => {
  storiesOf('Register/Error', module)
    .add('Normal', () => <Error {...props} />)
    .add('DeviceNoProvision', () => (
      <Error
        {...props}
        error={convertToRPCError({code: constantsStatusCode.scdevicenoprovision, desc: ''})}
      />
    ))
    .add('KeyNoMatchingGPG', () => (
      <Error {...props} error={convertToRPCError({code: constantsStatusCode.sckeynomatchinggpg, desc: ''})} />
    ))
    .add('KeyNotFound', () => (
      <Error {...props} error={convertToRPCError({code: constantsStatusCode.sckeynotfound, desc: ''})} />
    ))
    .add('UserNotFound', () => (
      <Error {...props} error={convertToRPCError({code: constantsStatusCode.scnotfound, desc: ''})} />
    ))
    .add('BadLoginPassword', () => (
      <Error {...props} error={convertToRPCError({code: constantsStatusCode.scbadloginpassword, desc: ''})} />
    ))
    .add('KeyNoSecret', () => (
      <Error {...props} error={convertToRPCError({code: constantsStatusCode.sckeynosecret, desc: ''})} />
    ))
}

export default load
