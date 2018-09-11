// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ProvePgpChoice from './prove-pgp-choice'
import PgpAdd from './add'
import GeneratingPgp from './generating-pgp'
import FinishedGeneratedPgp from './finished-generating-pgp'
import ProvePgpImport from './prove-pgp-import'

const addProps = {
  email1: 'chris@bitcoyne.com',
  email2: null,
  email3: null,
  errorEmail1: false,
  errorEmail2: false,
  errorEmail3: false,
  errorText: null,
  fullName: 'Chris Coyne',
  onCancel: action('onCancel'),
  onChangeEmail1: action('onChangeEmail1'),
  onChangeEmail2: action('onChangeEmail2'),
  onChangeEmail3: action('onChangeEmail3'),
  onChangeFullName: action('onChangeFullName'),
  onNext: action('onNext'),
}

const load = () => {
  storiesOf('Profile/PGP', module)
    .add('Choice', () => (
      <ProvePgpChoice onCancel={action('onCancel')} onOptionClick={action('onOptionClick')} />
    ))
    .add('Add normal', () => <PgpAdd {...addProps} />)
    .add('Add empty', () => <PgpAdd {...addProps} email1={null} fullName={null} />)
    .add('Add error email', () => (
      <PgpAdd {...addProps} errorText={'Some email addresses are invalid. Please fix!'} errorEmail1={true} />
    ))
    .add('Import', () => <ProvePgpImport onCancel={action('onCancel')} />)
    .add('Finished Generated Pgp', () => (
      <FinishedGeneratedPgp
        onDone={action('onDone')}
        pgpKeyString={
          '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: GPGTools - https://gpgtools.org\n\nmQINBFWtLwEBEADLvrTe/bzrKVL0Z4bofdrLACmwC8PGXk3iD6t+1uTBKVMpfqkH\nQxGVECp598wS8XI6ZC+sMUM+AGTROi+HUsfn2cFk6y6pYl/z9A7lgctoX5xKXYTt\nE4xAZBeN1mn+x2YTjHW2lga/SZmh5qpSn5AMeNe42R0EtZ9FrCwD+IiOlw/LqGoh\n7DHKVDHmqK//mfK/lFTJck+HPkgmLyC4iYjpGuqXKqODUtMFT4+bHYfowG8WkvVX\ncf59Z6Fc7PA+rSFy9QXt7TP1po5Mnxxr9jcqQzzy3BSrAhHxAPj3F9rWBLUG0yGJ\nmAy6c1yTsbSgviiA0n4gjqPVj3iD3aiOx/KGxCdN/vru37Gp5q4KiBz7yHIqvg3B\nSeCBEOremB3gZG24OIVncpr0U6qITaFIe6iHmx53sID9JAKwfxAIwcktXe+aGtWp\n'
        }
      />
    ))
    .add('Generating', () => <GeneratingPgp onCancel={action('onCancel')} />)
}

export default load
