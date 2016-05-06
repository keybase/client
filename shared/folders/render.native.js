// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar} from '../common-adapters'
import List from './list'
import {globalStyles} from '../styles/style-guide'

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

  render () {
    return (
      <Box style={stylesContainer}>
        <TabBar tabWidth={130}>
          <TabBar.Item label={'private/' + this.props.privateBadge} selected={this.state.showPrivate}
            onClick={() => this.setState({showPrivate: true})}>
            <List {...this.props.private} />
          </TabBar.Item>
          <TabBar.Item label={'public/' + this.props.publicBadge} selected={!this.state.showPrivate}
            onClick={() => this.setState({showPrivate: false})}>
            <List {...this.props.public} />
          </TabBar.Item>
        </TabBar>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1
}

export default Render
