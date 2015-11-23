'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import {IconButton} from 'material-ui'
import NavigationClose from 'material-ui/lib/svg-icons/navigation/close'

import path from 'path'
// $FlowFixMe styles
import commonStyles from '../styles/common'

export type HeaderProps = {
  reason: string,
  onClose: () => void
}

export default class HeaderRender extends Component {
  props: HeaderProps;

  render (): ReactElement {
    return (
      <div style={{...this.props.style, ...styles.container}}>
        <img style={styles.logo} src={`file:///${path.resolve('../react-native/react/images/service/keybase.png')}`}/>
        <p>{this.props.reason}</p>
        <IconButton onTouchTap={() => this.props.onClose()}>
          <NavigationClose />
        </IconButton>
      </div>
    )
  }
}

HeaderRender.propTypes = {
  reason: React.PropTypes.string.isRequired,
  onClose: React.PropTypes.func.isRequired,
  style: React.PropTypes.object.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxRow,
    paddingLeft: 15,
    paddingRight: 9,
    alignItems: 'center'
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 7
  }
}
