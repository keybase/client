// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {NativeFlatList} from '../../../../common-adapters/native-wrappers.native'
import * as Styles from '../../../../styles'
import type {Props} from './suggestion-list'

const SuggestionList = (props: Props) => (
  <NativeFlatList
    alwaysBounceVertical={false}
    style={Styles.collapseStyles([styles.list, props.style])}
    renderItem={({index, item}) => props.renderItem(index, item)}
    data={props.items}
    keyExtractor={props.keyExtractor || (item => item)}
    keyboardShouldPersistTaps="always"
    windowSize={10}
  />
)

const styles = Styles.styleSheetCreate({
  list: {flexGrow: 0, marginTop: 'auto'},
})

export default SuggestionList
