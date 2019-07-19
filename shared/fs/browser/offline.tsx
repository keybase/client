import * as Kb from '../../common-adapters'
import React from 'react'
import * as Styles from '../../styles/index'
import * as Types from '../../constants/types/fs'
import TopBar from '../top-bar'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/typed-connect'

type Props = {
  path: Types.Path
  syncEnabled: boolean
}

const OfflineFolder = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.contentContainer} fullWidth={true} alignItems="stretch">
    <TopBar path={props.path} />
    <Kb.Box2 direction="vertical" style={styles.emptyContainer} fullWidth={true} centerChildren={true}>
      <Kb.Icon
        type={props.syncEnabled ? 'iconfont-time' : 'iconfont-cloud'}
        sizeType="Huge"
        color={Styles.globalColors.black_10}
      />
      <Kb.Text type="BodySmall">
        {props.syncEnabled
          ? 'This folder will sync once you get back online.'
          : "You haven't synced this folder."}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  contentContainer: {
    flex: 1,
  },
  emptyContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
  },
})

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}) => ({
  syncConfig: Constants.getTlfFromPath(state.fs.tlfs, path).syncConfig,
})

const mergeProps = (stateProps, _, ownProps: OwnProps) => ({
  ...ownProps,
  syncEnabled: !!stateProps.syncConfig && stateProps.syncConfig.mode === Types.TlfSyncMode.Enabled,
})

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'OfflineFolder')(OfflineFolder)
