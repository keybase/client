// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import {storiesOf} from '@storybook/react-native'
import {action} from '@storybook/addon-actions'
import * as React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {type SelectorMap} from './storybook'

const createPropProvider = (map: SelectorMap) => (story: () => React.Node) => (
  <Provider store={createStore(state => state, map)}>{story()}</Provider>
)

export {action, storiesOf, createPropProvider}
