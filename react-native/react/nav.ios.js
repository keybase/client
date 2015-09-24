'use strict'

import React from 'react-native'

const {
  Component,
  TabBarIOS,
  View,
  Text
} = React

class Nav extends Component {
  constructor (props) {
    super(props)
    this.state = {
      selectedTab: 'blueTab',
      notifCount: 0
    }
  }

  _renderContent () {
    return <View><Text>hey</Text></View>
  }

  render () {
    return (
      <View style={{flex: 1}}>
        <TabBarIOS
          tintColor='white'
          barTintColor='darkslateblue'>

          <TabBarIOS.Item
            title='Blue Tab'
            selected={this.state.selectedTab === 'blueTab'}
            onPress={() => {
              this.setState({
                selectedTab: 'blueTab'
              })
            }}>
            {this._renderContent('#414A8C', 'Blue Tab')}
          </TabBarIOS.Item>

          <TabBarIOS.Item
            systemIcon='history'
            badge={this.state.notifCount > 0 ? this.state.notifCount : undefined}
            selected={this.state.selectedTab === 'redTab'}
            onPress={() => {
              this.setState({
                selectedTab: 'redTab',
                notifCount: this.state.notifCount + 1
              })
            }}>
            {this._renderContent('#783E33', 'Red Tab', this.state.notifCount)}
          </TabBarIOS.Item>
          <TabBarIOS.Item
            systemIcon='more'
            selected={this.state.selectedTab === 'greenTab'}
            onPress={() => {
              this.setState({
                selectedTab: 'greenTab',
                presses: this.state.presses + 1
              })
            }}>
            {this._renderContent('#21551C', 'Green Tab', this.state.presses)}
          </TabBarIOS.Item>
        </TabBarIOS>
      </View>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {component: Nav},
      parseNextRoute: null
    }
  }
}

export default Nav
