import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Choice from './choice.desktop'
import Info from './info.desktop'
import Generate from './generate.desktop'
import Finished from './finished.desktop'
import Import from './import.desktop'

const provider = Sb.createPropProviderWithCommon({
  Choice: () => ({
    onCancel: Sb.action('onCancel'),
    onOptionClick: Sb.action('onOptionClick'),
  }),
  Finished: () => ({
    onDone: Sb.action('onDone'),
    pgpKeyString:
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: GPGTools - https://gpgtools.org\n\nmQINBFWtLwEBEADLvrTe/bzrKVL0Z4bofdrLACmwC8PGXk3iD6t+1uTBKVMpfqkH\nQxGVECp598wS8XI6ZC+sMUM+AGTROi+HUsfn2cFk6y6pYl/z9A7lgctoX5xKXYTt\nE4xAZBeN1mn+x2YTjHW2lga/SZmh5qpSn5AMeNe42R0EtZ9FrCwD+IiOlw/LqGoh\n7DHKVDHmqK//mfK/lFTJck+HPkgmLyC4iYjpGuqXKqODUtMFT4+bHYfowG8WkvVX\ncf59Z6Fc7PA+rSFy9QXt7TP1po5Mnxxr9jcqQzzy3BSrAhHxAPj3F9rWBLUG0yGJ\nmAy6c1yTsbSgviiA0n4gjqPVj3iD3aiOx/KGxCdN/vru37Gp5q4KiBz7yHIqvg3B\nSeCBEOremB3gZG24OIVncpr0U6qITaFIe6iHmx53sID9JAKwfxAIwcktXe+aGtWp\n',
    promptShouldStoreKeyOnServer: true,
  }),
  Generate: () => ({onCancel: Sb.action('onCancel')}),
  Import: () => ({onCancel: Sb.action('onCancel')}),
  Info: p => ({
    email1: 'chris@bitcoyne.com',
    email2: null,
    email3: null,
    errorEmail1: false,
    errorEmail2: false,
    errorEmail3: false,
    errorText: null,
    fullName: 'Chris Coyne',
    onCancel: Sb.action('onCancel'),
    onChangeEmail1: Sb.action('onChangeEmail1'),
    onChangeEmail2: Sb.action('onChangeEmail2'),
    onChangeEmail3: Sb.action('onChangeEmail3'),
    onChangeFullName: Sb.action('onChangeFullName'),
    onNext: Sb.action('onNext'),
    ...p.storyProps,
  }),
})

const load = () => {
  Sb.storiesOf('Profile/PGP', module)
    .addDecorator(provider)
    .add('Choice', () => <Choice />)
    .add('Add normal', () => <Info />)
    .add('Add empty', () => (
      <Info
        {...Sb.propOverridesForStory({
          email1: null,
          fullName: null,
        })}
      />
    ))
    .add('Add error email', () => (
      <Info
        {...Sb.propOverridesForStory({
          errorEmail1: true,
          errorText: 'Some email addresses are invalid. Please fix!',
        })}
      />
    ))
    // @ts-ignore
    .add('Import', () => <Import />)
    // @ts-ignore
    .add('Finished Generated Pgp', () => <Finished />)
    .add('Generating', () => <Generate />)
}

export default load
