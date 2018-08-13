// @flow
// import * as React from 'react'
// import * as Sb from '../../../stories/storybook'
import header from './header/index.stories'
import settingsPopup from './settings-popup/index.stories'

const load = () => {
  header()
  settingsPopup()
}

export default load
