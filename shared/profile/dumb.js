// @noflow
import ProveWebsiteChoice from './prove-website-choice'
import Revoke from './revoke'
import pgpDumb from './pgp/dumb'
import type {DumbComponentMap} from '../constants/types/more'

const dumbProveWebsiteChoice: DumbComponentMap<ProveWebsiteChoice> = {
  component: ProveWebsiteChoice,
  mocks: {
    'DNS or File': {
      onCancel: () => console.log('ProveWebsiteChoice: onCancel'),
      onOptionClick: op => console.log(`ProveWebsiteChoice: onOptionClick = ${op}`),
    },
  },
}

export default {
  'Revoke Proof': dumbRevoke,
  'New Proof: Website': dumbProveWebsiteChoice,
  ...pgpDumb,
}
