// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'
import {convertToRPCError} from '../../../util/errors'

const baseMock = {
  onBack: () => console.log('onBack'),
  error: convertToRPCError({
    code: 901,
    desc: "You don't have a public key; try `keybase pgp select` or `keybase pgp import` if you have a key; or `keybase pgp gen` if you don't",
  }),
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': baseMock,
  },
}

export default dumbComponentMap
