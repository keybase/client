// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
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
  onAttach: (path: Types.Path, local: Array<string>) => void,
}

class Files extends React.PureComponent<FolderProps, State> {
  //      this.props.onAttach(this.props.path, paths)

  render() {
    // TODO check whether the path is writable by the user.
    const dndEnabled = Types.getPathLevel(this.props.path) > 2
    const onAttach = paths => this.props.onAttach(this.props.path, paths)
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
      <Kb.DropFileBox
        direction="vertical"
        fullHeight={true}
        style={styles.container}
        onAttach={dndEnabled ? onAttach : null}
      >
        <Kb.Box2 direction="vertical" fullHeight={true}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
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
      </Kb.DropFileBox>
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
