import React, {Component} from '../base-react'

import Header from './header.render'
import Action from './action.render'
import Bio from './bio.render'
import Proofs from './proofs.render'

import commonStyles from '../styles/common'

export default class Render extends Component {
  render () {
    return (
      <div style={styles.container}>
        <Header style={styles.header} {...this.props} />
        <div style={styles.bodyContainer}>
          <Bio style={styles.bio} {...this.props} />
          <Proofs style={styles.proofs} {...this.props} />
        </div>
        <Action style={styles.action} {...this.props} />
      </div>
    )
  }
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    width: 520,
    height: 332,
    fontFamily: 'Noto Sans'
  },
  header: {
    height: 34
  },
  bodyContainer: {
    ...commonStyles.flexBoxRow,
    height: 242
  },
  bio: {
    width: 202
  },
  proofs: {
  },
  action: {
    height: 56
  }
}
