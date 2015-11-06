'use strict'

import BaseComponent from './base-component'
import { connect } from './base-redux'
import MetaNavigator from './router/meta-navigator'
import React from 'react'
import { StyleSheet } from 'react'
import Folders from './tabs/folders'
import Chat from './tabs/chat'
import People from './tabs/people'
import Devices from './tabs/devices'
import NoTab from './tabs/no-tab'
import More from './tabs/more'

import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from './constants/tabs'
import { switchTab } from './actions/tabbed-router'
import { Tab, Tabs, IconButton, Styles } from 'material-ui'
let { Colors, Typography } = Styles;

const tabToRootRouteParse = {
  [FOLDER_TAB]: Folders,
  [CHAT_TAB]: Chat,
  [PEOPLE_TAB]: People,
  [DEVICES_TAB]: Devices,
  [MORE_TAB]: More
}

const menuItems = [
  { route: [FOLDER_TAB], text: 'Folders' },
  { route: [CHAT_TAB], text: 'Chat' },
  { route: [PEOPLE_TAB], text: 'People' },
  { route: [DEVICES_TAB], text: 'Devices' }
]

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
    const {dispatch} = this.props
    const activeTab = this.props.tabbedRouter.get('activeTab')

    let styles = {
      div: {
        position: 'absolute',
        left: 48,
        backgroundColor: Colors.cyan500,
        width: 0,
        height: 48,
      },
      headline: {
        fontSize: 24,
        lineHeight: '32px',
        paddingTop: 16,
        marginBottom: 12,
        letterSpacing: 0,
        fontWeight: Typography.fontWeightNormal,
        color: Typography.textDarkBlack,
      },
      iconButton: {
        position: 'absolute',
        left: 0,
        backgroundColor: Colors.cyan500,
        color: 'white',
        marginRight: 0,
      },
      iconStyle: {
        color: Colors.white,
      },
      tabs: {
        position: 'relative',
      },
      tabsContainer: {
        position: 'relative',
        paddingLeft: 0,
        width: '70%'
      },
    };

    return (
      <div style={styles.tabsContainer}>
        <Tabs valueLink={{value: activeTab, requestChange: this._handleTabsChange.bind(this)}}>
          <Tab label="More" value={MORE_TAB} >
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label="Folders" value={FOLDER_TAB} >
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label="Chat" value={CHAT_TAB}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label="People" value={PEOPLE_TAB}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
          <Tab label="Devices" value={DEVICES_TAB}>
            {this._renderContent('#aaaaaa', tabToRootRouteParse[activeTab])}
          </Tab>
        </Tabs>
      </div>
    )
  }
}
