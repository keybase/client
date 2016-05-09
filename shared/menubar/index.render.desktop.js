import React, {Component} from 'react'

import {Box} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import Folders from '../folders/render'

type State = {
  showingPublic: boolean
}

export default class Render extends Component<void, Props, State> {
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

    return (
      <Box style={styles.container}>
        <Box style={stylesTopRow}>
        </Box>
        <Folders
          {...this.props}
          private={noIgnorePrivate}
          public={noIgnorePublic}
          onSwitchTab={showingPublic => this.setState({showingPublic})}
          listStyle={{height: 350}}
          smallMode
          onClick={this.props.openKBFS}
        />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn
}

const stylesTopRow = {
  ...globalStyles.flexBoxRow
}

const stylesRow = {
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
