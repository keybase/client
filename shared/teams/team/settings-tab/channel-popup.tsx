import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {pluralize} from '../../../util/string'

type Props = {}

const ChannelPopup = (props: Props) => {
  // prettier-ignore
  const channels = ['Aab', 'NSFW', 'NY_MemorialDay', 'airdrop', 'android', 'android-notifications', 'autoresets', 'frontend', 'core', 'design', 'squad-sqawk']
  const onChange = () => {}
  return (
    <Kb.FloatingBox dest="keyboard-avoiding-root">
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.underlay}>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.overlay}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header} gap="tiny">
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerTop}>
              <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
              <Kb.Text type="BodyBigLink">Add (2)</Kb.Text>
            </Kb.Box2>
            <Kb.SearchFilter
              placeholderText={`Search ${channels.length} ${pluralize('channel', channels.length)}`}
              size="full-width"
              onChange={onChange}
              style={styles.searchFilter}
              placeholderCentered={true}
              icon="iconfont-search"
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  header: {
    ...Styles.padding(19, Styles.globalMargins.small, Styles.globalMargins.tiny),
  },
  headerTop: {justifyContent: 'space-between'},
  overlay: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
  },
  searchFilter: {paddingLeft: 0, paddingRight: 0},
  underlay: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.padding(59, 16),
    backgroundColor: Styles.globalColors.black_50,
  },
}))

export default ChannelPopup
