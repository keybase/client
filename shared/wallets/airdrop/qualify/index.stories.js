// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Qualify from '.'

const rows = [
  {
    subTitle:
      'Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long subtitle',
    title: '3 installed devices or paper keys',
    valid: false,
  },
  {subTitle: '', title: 'Running a recent version of Keybase', valid: true},
  {
    subTitle: 'You need to have joined Keybase before July 1, 2018.',
    title: 'Old enough Keybase account',
    valid: false,
  },
  {subTitle: '', title: 'Old enough GitHub or Hacker News', valid: true},
  {subTitle: '', title: "Registration deadline hasn't passed", valid: true},
]

const props = {
  onCancel: Sb.action('onCancel'),
  onSubmit: Sb.action('onSubmit'),
  rows,
}

const load = () => {
  Sb.storiesOf('Settings/AirdropQualify', module)
    .add('Sad', () => <Qualify {...props} state="unqualified" />)
    .add('Happy', () => (
      <Qualify {...props} rows={props.rows.map(r => ({...r, subTitle: '', valid: true}))} state="qualified" />
    ))
    .add('Loading', () => <Qualify {...props} state="loading" />)
    .add('Accepted', () => <Qualify {...props} state="accepted" />)
}

export default load
