// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import FolderHeader from '../header/container'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import ConnectedResetBanner from '../banner/reset-banner/container'
import Rows from '../row/rows-container'
import DropTarget from './drop-target'

type FolderProps = {
  isUserReset: boolean,
  sortSetting: Types.SortSetting,
  onAttach?: ?(paths: Array<string>) => void,
  path: Types.Path,
  resetParticipants: Array<string>,
  routePath: I.List<string>,
}

class Files extends React.PureComponent<FolderProps> {
  renderContent() {
    return (
      <DropTarget onAttach={this.props.onAttach}>
        <Rows path={this.props.path} routePath={this.props.routePath} sortSetting={this.props.sortSetting} />
      </DropTarget>
    )
  }
  render() {
    const content = this.props.isUserReset ? (
      <Kb.Box2 direction="vertical" fullHeight={true}>
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
          <Kb.Icon type="icon-access-denied-266" />
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      this.renderContent()
    )
    return (
      <Kb.BoxGrow>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          <FolderHeader path={this.props.path} routePath={this.props.routePath} />
          <Kbfs.Errs />
          <Kb.Divider />
          {isMobile ? (
            <Kb.ScrollView>
              {this.props.resetParticipants.length > 0 && <ConnectedResetBanner path={this.props.path} />}
              <Kb.Box>{content}</Kb.Box>
            </Kb.ScrollView>
          ) : (
            <>
              {this.props.resetParticipants.length > 0 && <ConnectedResetBanner path={this.props.path} />}
              {content}
            </>
          )}
          <Footer />
        </Kb.Box2>
      </Kb.BoxGrow>
    )
  }
}

export default Files
