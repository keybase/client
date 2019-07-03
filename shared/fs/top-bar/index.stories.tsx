import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import TopBar from '.'

export const topBarProvider = {
  SyncToggle: () => ({
    disableSync: Sb.action('disableSync'),
    enableSync: Sb.action('enableSyncisableSync'),
    syncConfig: Constants.tlfSyncEnabled,
    waiting: false,
  }),
  TopBarLoading: () => ({
    show: true,
  }),
  TopBarSort: ({path}: {path: Types.Path}) => ({
    sortByNameAsc: path === Constants.defaultPath ? undefined : Sb.action('sortByNameAsc'),
    sortByNameDesc: path === Constants.defaultPath ? undefined : Sb.action('sortByNameDesc'),
    sortByTimeAsc: Types.getPathLevel(path) < 3 ? undefined : Sb.action('sortByTimeAsc'),
    sortByTimeDesc: Types.getPathLevel(path) < 3 ? undefined : Sb.action('sortByTimeDesc'),
    sortSetting: Types.SortSetting.NameAsc,
  }),
}

const provider = Sb.createPropProviderWithCommon(topBarProvider)

const Wrap = props => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Text type="Body">{props.label}</Kb.Text>
    <Kb.Box style={styles.flex}>{props.children}</Kb.Box>
  </Kb.Box2>
)

const load = () =>
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('TopBar', () => (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {['/keybase', '/keybase/team', '/keybase/team/kbkbfstest'].map(pathStr => (
          <Wrap label={pathStr} key={pathStr}>
            <TopBar path={Types.stringToPath(pathStr)} />
          </Wrap>
        ))}
      </Kb.Box2>
    ))

export default load

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blue,
    padding: Styles.globalMargins.medium,
  },
  flex: {flex: 1},
})
