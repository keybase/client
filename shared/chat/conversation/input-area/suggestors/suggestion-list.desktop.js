// @flow
import * as React from 'react'
import ReactList from 'react-list'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {Props} from './suggestion-list'

const SuggestionList = (props: Props) => (
  <Kb.ScrollView style={Styles.collapseStyles([styles.fullHeight, props.style])}>
    <ReactList itemRenderer={index => props.renderItem(props.items[index])} length={props.items.length} />
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  fullHeight: {
    height: '100%',
  },
})

export default SuggestionList
