// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/fs'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import FolderHeader from './header/container'
import SortBar from './sortbar/container'
import Footer from './footer/footer'
import {isMobile} from '../constants/platform'
import ConnectedResetBanner from './banner/reset-banner/container'
import Rows from './row/rows-container'

type FolderProps = {
  isUserReset: boolean,
  sortSetting: Types.SortSetting,
  path: Types.Path,
  resetParticipants: Array<string>,
  routePath: I.List<string>,
}

class Files extends React.PureComponent<FolderProps> {
  render() {
    console.log({songgao: 'Files', path: this.props.path, props: this.props})
    const content = this.props.isUserReset ? (
      <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
        <Kb.Box style={styles.resetContainer}>
          <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
          <Kb.Icon type="icon-access-denied-266" />
        </Kb.Box>
      </Kb.Box>
    ) : (
      <Rows
        path={this.props.path}
        routePath={this.props.routePath}
        sortSetting={this.props.sortSetting}
        ifEmpty={
          <Kb.Box style={styles.emptyContainer}>
            <Kb.Text type="BodySmall">This is an empty folder.</Kb.Text>
          </Kb.Box>
        }
      />
    )
    return (
      <Kb.Box style={styles.outerContainer}>
        <Kb.Box style={styles.container}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
          <SortBar path={this.props.path} />
          {isMobile && this.props.resetParticipants.length > 0 ? (
            <Kb.ScrollView>
              <ConnectedResetBanner path={this.props.path} />
              <Kb.Box>{content}</Kb.Box>
            </Kb.ScrollView>
          ) : (
            content
          )}
          <Footer />
        </Kb.Box>
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  outerContainer: {
    height: '100%',
    position: 'relative',
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fullHeight,
    flex: 1,
  },
  emptyContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fullHeight,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: 2 * Styles.globalMargins.xlarge,
  },
})

export default Files
