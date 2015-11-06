'use strict'

import BaseComponent from './base-component'
import { connect } from './base-redux'
import MetaNavigator from './router/meta-navigator'
import React from 'react'
import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'

import { folderTab, chatTab, peopleTab, devicesTab, moreTab } from './constants/tabs'
import { switchTab } from './actions/tabbed-router'
import { Tab, Tabs, Styles } from 'material-ui'
let { Colors, Typography } = Styles

const tabToRootRouteParse = {
  [folderTab]: Folders,
  [chatTab]: Chat,
  [peopleTab]: People,
  [devicesTab]: Devices,
  [moreTab]: More
}

export default class Nav extends BaseComponent {
  _renderContent (activeTab, rootComponent) {
    return (
      <div>
        {React.createElement(
          connect(state => {
            return state.tabbedRouter.getIn(['tabs', state.tabbedRouter.get('activeTab')]).toObject()
          })(MetaNavigator), {
            store: this.props.store,
            rootComponent: rootComponent || tabToRootComponent[activeTab] || NoTab
          }
        )}
      </div>
    )
  }

  _handleTabsChange (e, key, payload) {
    this.props.dispatch(switchTab(e))
  }

  render () {
    const activeTab = this.props.tabbedRouter.get('activeTab')

    let styles = {
      div: {
        position: 'absolute',
        left: 48,
        backgroundColor: Colors.cyan500,
        width: 0,
        height: 48
      },
      headline: {
        fontSize: 24,
        lineHeight: '32px',
        paddingTop: 16,
        marginBottom: 12,
        letterSpacing: 0,
        fontWeight: Typography.fontWeightNormal,
        color: Typography.textDarkBlack
      },
      iconButton: {
        position: 'absolute',
        left: 0,
        backgroundColor: Colors.cyan500,
        color: 'white',
        marginRight: 0
      },
      iconStyle: {
        color: Colors.white
      },
      tabs: {
        position: 'relative'
      },
      tabsContainer: {
        position: 'relative',
        paddingLeft: 0,
        width: '70%'
      }
    }

    return (
      <div style={styles.tabsContainer}>
        <Tabs valueLink={{value: activeTab, requestChange: this._handleTabsChange.bind(this)}}>
          <Tab label='More' value={moreTab} >
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label='Folders' value={folderTab} >
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label='Chat' value={chatTab}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label='People' value={peopleTab}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label='Devices' value={devicesTab}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
        </Tabs>
      </div>
    )
  }
}
