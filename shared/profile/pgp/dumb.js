// @flow
import ProvePgpChoice from './prove-pgp-choice'
import PgpAdd from './add'
import GeneratingPgp from './generating-pgp'
import FinishedGeneratedPgp from './finished-generating-pgp'
import ProvePgpImport from './prove-pgp-import'
import type {DumbComponentMap} from '../../constants/types/more'

const dumbProvePgpChoice: DumbComponentMap<ProvePgpChoice> = {
  component: ProvePgpChoice,
  mocks: {
    'Import or Generate': {
      onCancel: () => console.log('ProvePgpChoice: onCancel'),
      onOptionClick: op => console.log(`ProvePgpChoice: onOptionClick = ${op}`),
    },
  },
}

const addBase = {
  fullName: 'Chris Coyne',
  email1: 'chris@bitcoyne.com',
  email2: null,
  email3: null,
  errorText: null,
  errorEmail1: false,
  errorEmail2: false,
  errorEmail3: false,
  onChangeFullName: next => console.log('clicked:', 'onChangeFullName'),
  onChangeEmail1: next => console.log('clicked: onChangeEmail1'),
  onChangeEmail2: next => console.log('clicked: onChangeEmail2'),
  onChangeEmail3: next => console.log('clicked: onChangeEmail3'),
  onCancel: () => console.log('clicked: onCancel'),
  onNext: () => console.log('clicked: onNext'),
}

const addMap: DumbComponentMap<PgpAdd> = {
  component: PgpAdd,
  mocks: {
    Normal: addBase,
    Empty: {
      ...addBase,
      email1: null,
      fullName: null,
    },
    'One Error - Email': {
      ...addBase,
      errorText: 'Some email addresses are invalid. Please fix!',
      errorEmail1: true,
    },
  },
}

const dumbProvePgpImport: DumbComponentMap<ProvePgpImport> = {
  component: ProvePgpImport,
  mocks: {
    'Import PGP': {
      onCancel: () => console.log('ProvePgpImport: onCancel'),
    },
  },
}

const dumbFinishedGeneratingPgp: DumbComponentMap<FinishedGeneratedPgp> = {
  component: FinishedGeneratedPgp,
  mocks: {
    ' ': {
      onDone: shouldStoreKeyOnServer =>
        console.log(
          `FinishedGeneratedPgp: onDone [shouldStoreKeyOnServer: ${String(shouldStoreKeyOnServer)}]`
        ),
      pgpKeyString: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: GPGTools - https://gpgtools.org\n\nmQINBFWtLwEBEADLvrTe/bzrKVL0Z4bofdrLACmwC8PGXk3iD6t+1uTBKVMpfqkH\nQxGVECp598wS8XI6ZC+sMUM+AGTROi+HUsfn2cFk6y6pYl/z9A7lgctoX5xKXYTt\nE4xAZBeN1mn+x2YTjHW2lga/SZmh5qpSn5AMeNe42R0EtZ9FrCwD+IiOlw/LqGoh\n7DHKVDHmqK//mfK/lFTJck+HPkgmLyC4iYjpGuqXKqODUtMFT4+bHYfowG8WkvVX\ncf59Z6Fc7PA+rSFy9QXt7TP1po5Mnxxr9jcqQzzy3BSrAhHxAPj3F9rWBLUG0yGJ\nmAy6c1yTsbSgviiA0n4gjqPVj3iD3aiOx/KGxCdN/vru37Gp5q4KiBz7yHIqvg3B\nSeCBEOremB3gZG24OIVncpr0U6qITaFIe6iHmx53sID9JAKwfxAIwcktXe+aGtWp\n',
    },
  },
}

const dumbGeneratingPgp: DumbComponentMap<GeneratingPgp> = {
  component: GeneratingPgp,
  mocks: {
    'Generating PGP': {
      onCancel: () => console.log('GeneratingPgp: onCancel'),
    },
  },
}

export default {
  'New Proof: PGP': dumbProvePgpChoice,
  'New Proof: PGP add': addMap,
  'New Proof: PGP import': dumbProvePgpImport,
  'New Proof: PGP generating': dumbGeneratingPgp,
  'New Proof: PGP generate finished': dumbFinishedGeneratingPgp,
}
