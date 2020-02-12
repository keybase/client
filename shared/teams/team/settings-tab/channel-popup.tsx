import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'

type Props = {
  disabledChannels?: Array<string>
  onComplete: (channels: Array<string>) => void
  teamID: Types.TeamID
}

const ChannelPopup = (props: Props) => {
  // prettier-ignore
  const channels = ['Aab', 'NSFW', 'NY_MemorialDay', 'airdrop', 'android', 'android-notifications', 'autoresets', 'frontend', 'core', 'design', 'squad-sqawk', 'squad-birbs', 'squad-beasts', 'squad-dogs-of-the-sea-and-other-creatures']
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
          <Kb.BoxGrow>
            <Kb.ScrollView>
              {channels.map(c => (
                <Kb.Box2
                  key={c}
                  direction="horizontal"
                  style={styles.channelContainer}
                  gap="tiny"
                  fullWidth={true}
                >
                  <Kb.Text type="Body" lineClamp={1} style={Styles.globalStyles.flexOne}>
                    #{c}
                  </Kb.Text>
                  <Kb.CheckCircle />
                </Kb.Box2>
              ))}
            </Kb.ScrollView>
          </Kb.BoxGrow>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  channelContainer: {
    ...Styles.padding(14, Styles.globalMargins.medium, 14, Styles.globalMargins.small),
    justifyContent: 'space-between',
  },
  header: {
    ...Styles.padding(19, Styles.globalMargins.small, 0),
  },
  headerTop: {justifyContent: 'space-between'},
  overlay: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    maxHeight: 450,
  },
  searchFilter: {paddingLeft: 0, paddingRight: 0},
  underlay: {
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.padding(27, Styles.globalMargins.small, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.black_50,
  },
}))

export default ChannelPopup
