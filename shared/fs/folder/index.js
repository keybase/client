// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import FolderHeader from '../header/container'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import ConnectedResetBanner from '../banner/reset-banner/container'
import Rows from '../row/rows-container'

type FolderProps = {
  isUserReset: boolean,
  sortSetting: Types.SortSetting,
  path: Types.Path,
  resetParticipants: Array<string>,
  routePath: I.List<string>,
}

class Files extends React.PureComponent<FolderProps> {
  render() {
    const content = this.props.isUserReset ? (
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
          <Kb.Icon type="icon-access-denied-266" />
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Rows path={this.props.path} routePath={this.props.routePath} sortSetting={this.props.sortSetting} />
    )
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
          <Kbfs.Errs />
          <Kb.Divider />
          {isMobile && this.props.resetParticipants.length > 0 ? (
            <Kb.ScrollView>
              <ConnectedResetBanner path={this.props.path} />
              <Kb.Box>{content}</Kb.Box>
            </Kb.ScrollView>
          ) : (
            content
          )}
          <Footer />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    position: 'relative',
  },
  resetContainer: {
    marginTop: 2 * Styles.globalMargins.xlarge,
  },
})

export default Files
