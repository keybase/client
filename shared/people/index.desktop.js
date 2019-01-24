// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import flags from '../util/feature-flags'

export const Header = (props: Props) => (
  <Kb.HeaderHocHeader
    headerStyle={styles.header}
    borderless={true}
    rightActions={[
      {
        custom: (
          <Kb.Avatar
            username={props.myUsername}
            onClick={() => props.onClickUser(props.myUsername)}
            size={32}
          />
        ),
        label: 'Avatar',
      },
    ]}
    titleComponent={<PeoplePageSearchBar {...props} />}
  />
)
const People = (props: Props) => (
  <Kb.ScrollView style={styles.scrollView}>
    {props.waiting && (
      <Kb.ProgressIndicator
        style={{height: 32, left: 96, position: 'absolute', top: 8, width: 32, zIndex: 2}}
      />
    )}
    {!flags.useNewRouter && (
      <Kb.Box2 direction="horizontal" centerChildren={true}>
        <PeoplePageSearchBar {...props} />
      </Kb.Box2>
    )}
    <PeoplePageList {...props} />
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  header: {
    flexGrow: 1,
  },
  scrollView: {
    ...Styles.globalStyles.fullHeight,
  },
})

export default People
