// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import List from './list'
import {globalStyles, globalColors} from '../styles/style-guide'

type State = {
  showPrivate: boolean
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showPrivate: true
    }
  }

  _makeItem (isPublic: boolean) {
    return <TabBarButton
      source={{type: 'icon', icon: `subnav-folders-${isPublic ? 'public' : 'private'}`}}
      style={{
        ...styleItem,
        borderBottomWidth: 2,
        borderBottomColor: isPublic !== this.state.showPrivate
          ? (isPublic ? globalColors.yellowGreen : globalColors.darkBlue2)
          : globalColors.transparent
      }}
      styleBadge={styleBadge}
      styleIcon={styleIcon}
      styleLabel={{
        color: isPublic
          ? (this.state.showPrivate ? globalColors.white_75 : globalColors.black_75)
          : (this.state.showPrivate ? globalColors.white : globalColors.black)
      }}
      styleBadgeNumber={styleBadgeNumber}
      selected={isPublic !== this.state.showPrivate}
      label={isPublic ? 'public/' : 'private/'}
      badgeNumber={isPublic ? this.props.publicBadge : this.props.privateBadge}
    />
  }

  render () {
    return (
      <Box style={{...stylesContainer, backgroundColor: this.state.showPrivate ? globalColors.darkBlue : globalColors.white}}>
        <TabBar tabBarStyle={tabBarStyle}>
          <TabBarItem
            selected={this.state.showPrivate}
            containerStyle={itemContainerStyle}
            tabBarButton={this._makeItem(false)}
            onClick={() => {
              this.setState({showPrivate: true})
              this.props.onSwitchTab && this.props.onSwitchTab(false)
            }}>
            <List
              {...this.props.private}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onClick={this.props.onClick} />
          </TabBarItem>
          <TabBarItem
            selected={!this.state.showPrivate}
            containerStyle={itemContainerStyle}
            tabBarButton={this._makeItem(true)}
            onClick={() => {
              this.setState({showPrivate: false})
              this.props.onSwitchTab && this.props.onSwitchTab(true)
            }}>
            <List
              {...this.props.public}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onClick={this.props.onClick} />
          </TabBarItem>
        </TabBar>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1
}

const styleBadge = {
  borderWidth: 0,
  paddingLeft: 3,
  paddingRight: 3,
  borderRadius: 20,
  flex: 'initial',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 15,
  marginLeft: 2
}

const styleIcon = {
  marginRight: 8
}

const styleItem = {
  ...globalStyles.flexBoxRow,
  paddingTop: 8,
  paddingBottom: 8,
  backgroundColor: globalColors.transparent
}

const styleBadgeNumber = {
  lineHeight: '12px',
  fontSize: 10
}

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow
}

export default Render
