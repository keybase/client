/* @flow */

import React, {Component} from '../base-react'
import {globalStyles, globalColors, globalHacks} from '../styles/style-guide'
import resolveAssets from '../../../desktop/resolve-assets'

export default class Header extends Component {
  render (): ReactElement {
    return (
      <div style={{...this.props.style, ...styles.container}}>
        {this.props.children}
        {this.props.icon && <img style={styles.logo} src={`file://${resolveAssets('../react-native/react/images/service/keybase.png')}`}/>}
        <p style={styles.title}>{this.props.title}</p>
        {this.props.onClose && (
          <div style={styles.close} onClick={() => this.props.onClose()}>
            <i className='fa fa-times' ></i>
          </div>
        )}
      </div>
    )
  }
}

Header.propTypes = {
  icon: React.PropTypes.bool,
  children: React.PropTypes.any,
  title: React.PropTypes.string,
  onClose: React.PropTypes.func,
  style: React.PropTypes.object
}

const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.windowDragging,
    ...globalStyles.noSelect,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    height: 35 + globalHacks.framelessWindowDeadzone,
    borderTop: `solid ${globalColors.grey4} ${globalHacks.framelessWindowDeadzone}px`
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 8
  },
  title: {
    ...globalStyles.fontRegular,
    fontSize: 15,
    lineHeight: '20px',
    color: globalColors.grey1,
    flex: 1
  },
  close: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    ...globalStyles.windowDraggingClickable,
    color: globalColors.grey4,
    fontSize: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30
  }
}
