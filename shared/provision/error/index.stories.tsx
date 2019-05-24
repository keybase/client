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
    RPCTypes.StatusCode.scdeviceprovisionoffline,
    RPCTypes.StatusCode.scapinetworkerror,
    RPCTypes.StatusCode.scdevicenoprovision,
    RPCTypes.StatusCode.scdeviceprevprovisioned,
    RPCTypes.StatusCode.sckeynomatchinggpg,
    RPCTypes.StatusCode.sckeynotfound,
    RPCTypes.StatusCode.scnotfound,
    RPCTypes.StatusCode.scbadloginpassword,
    RPCTypes.StatusCode.sckeysyncedpgpnotfound,
    RPCTypes.StatusCode.scgpgunavailable,
    RPCTypes.StatusCode.sckeynosecret,
    RPCTypes.StatusCode.scinputcanceled,
    RPCTypes.StatusCode.sckeycorrupted,
    RPCTypes.StatusCode.scdeleted,
  ]
  const names = invert(RPCTypes.StatusCode)

  codes.forEach(code => {
    s = s.add(names[code], () => <Error {...props} error={convertToRPCError({code, desc: ''})} />)
  })

  let e = convertToRPCError({code: RPCTypes.StatusCode.sckeynomatchinggpg, desc: ''})
  e.fields = [{key: 'has_active_device', value: true}]
  s = s.add(names[RPCTypes.StatusCode.sckeynomatchinggpg] + ':has_active_device', () => (
    <Error {...props} error={e} />
  ))
}

export default load
