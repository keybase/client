// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {PeoplePageList} from './index.shared'
import {type Props} from '.'
import flags from '../util/feature-flags'
import ProfileSearch from '../profile/search/bar'

export const Header = flags.useNewRouter
  ? (props: Props) => (
      <Kb.Box2 direction="horizontal" style={styles.header}>
        <Kb.Text type="Header" style={styles.sectionTitle}>
          People
        </Kb.Text>
        <ProfileSearch />
      </Kb.Box2>
    )
  : (props: Props) => (
      <Kb.HeaderHocHeader
        headerStyle={styles.header}
        rightActions={[
          {
            custom: (
              <Kb.Avatar
                key="avatar"
                username={props.myUsername}
                onClick={() => props.onClickUser(props.myUsername)}
                size={32}
              />
            ),
            label: 'Avatar',
          },
        ]}
        titleComponent={<ProfileSearch />}
      />
    )
const People = (props: Props) => (
  <Kb.ScrollView style={styles.container}>
    {props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
    {!flags.useNewRouter && (
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.searchContainer}>
        <ProfileSearch />
      </Kb.Box2>
    )}
    <PeoplePageList {...props} />
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  container: {...Styles.globalStyles.fullHeight},
  header: flags.useNewRouter
    ? {
        flexGrow: 1,
        marginLeft: Styles.globalMargins.xsmall,
      }
    : {flexGrow: 1},
  progress: {
    height: 32,
    left: 96,
    position: 'absolute',
    top: 8,
    width: 32,
    zIndex: 2,
  },
  searchContainer: {paddingBottom: Styles.globalMargins.xsmall},
  sectionTitle: {flexGrow: 1},
})

export default People
