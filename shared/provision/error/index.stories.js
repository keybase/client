// @flow
import * as React from 'react'
import Error from '.'
import {action, storiesOf} from '../../stories/storybook'
import {convertToRPCError} from '../../util/errors'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {invert} from 'lodash-es'

const props = {
  error: convertToRPCError({
    code: 0,
    desc: 'Unknown error, sorry',
  }),
  onAccountReset: action('onAccountReset'),
  onBack: action('onBack'),
  onKBHome: action('onKBHome'),
  onPasswordReset: action('onPasswordReset'),
}

const load = () => {
  let s = storiesOf('Provision/Error', module).add('Normal', () => <Error {...props} />)

  const codes = [
    RPCTypes.constantsStatusCode.scdeviceprovisionoffline,
    RPCTypes.constantsStatusCode.scapinetworkerror,
    RPCTypes.constantsStatusCode.scdevicenoprovision,
    RPCTypes.constantsStatusCode.scdeviceprevprovisioned,
    RPCTypes.constantsStatusCode.sckeynomatchinggpg,
    RPCTypes.constantsStatusCode.sckeynotfound,
    RPCTypes.constantsStatusCode.scnotfound,
    RPCTypes.constantsStatusCode.scbadloginpassword,
    RPCTypes.constantsStatusCode.sckeysyncedpgpnotfound,
    RPCTypes.constantsStatusCode.scgpgunavailable,
    RPCTypes.constantsStatusCode.sckeynosecret,
    RPCTypes.constantsStatusCode.scinputcanceled,
    RPCTypes.constantsStatusCode.sckeycorrupted,
    RPCTypes.constantsStatusCode.scdeleted,
  ]
  const names = invert(RPCTypes.constantsStatusCode)

  codes.forEach(code => {
    s = s.add(names[code], () => <Error {...props} error={convertToRPCError({code, desc: ''})} />)
  })

  let e = convertToRPCError({code: RPCTypes.constantsStatusCode.sckeynomatchinggpg, desc: ''})
  e.fields = [{key: 'has_active_device', value: true}]
  s = s.add(names[RPCTypes.constantsStatusCode.sckeynomatchinggpg] + ':has_active_device', () => (
    <Error {...props} error={e} />
  ))
}

export default load
