// @flow
import React, {Component} from 'react'

import {Box} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import Folders from '../folders/render'
import type {Props} from './index.render'

type State = {
  showingPublic: boolean
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showingPublic: false
    }
  }

  render () {
    const noIgnorePrivate = {
      ...this.props.private,
      ignored: []
    }

    const noIgnorePublic = {
      ...this.props.public,
      ignored: []
    }

    const styles = this.state.showingPublic ? stylesPublic : stylesPrivate

    const mergedProps = {
      ...this.props,
      smallMode: true,
      private: noIgnorePrivate,
      public: noIgnorePublic,
      onSwitchTab: showingPublic => this.setState({showingPublic}),
      listStyle: {height: 350},
      onClick: this.props.openKBFS
    }

    return (
      <Box style={styles.container}>
        <Box style={stylesTopRow} />
        <Folders {...mergedProps} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1
}

const stylesTopRow = {
  ...globalStyles.flexBoxRow
}

const stylesPrivate = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.darkBlue
  }
}

const stylesPublic = {
  container: {
    ...stylesContainer,
    backgroundColor: globalColors.yellowGreen
  }
}

export default Render
