// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {NativeFlatList} from '../../../../common-adapters/native-wrappers.native'
import * as Styles from '../../../../styles'
import type {Props} from './suggestion-list'

const SuggestionList = (props: Props) => (
  <NativeFlatList
    renderItem={({index, item}) => props.renderItem(index, item)}
    data={props.items}
    keyExtractor={item => item}
    keyboardShouldPersistTaps="always"
    windowSize={10}
  />
)

export default SuggestionList
