/* @flow */

import React, {Component} from '../base-react'
import commonStyles from '../styles/common'
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
    paddingTop: 20, // TEMP workaround for https://github.com/atom/electron/issues/983, you don't get mouse events in the header
    ...commonStyles.flexBoxRow,
    ...commonStyles.windowDragging,
    ...commonStyles.noSelect,
    paddingLeft: 9,
    paddingRight: 9,
    alignItems: 'center',
    height: 35 + 20 // TEMP workaround above
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 7
  },
  title: {
    color: '#20C0EF',
    flex: 1
  },
  close: {
    ...commonStyles.flexBoxRow,
    ...commonStyles.clickable,
    ...commonStyles.windowDraggingClickable,
    color: '#D0D4DA',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30
  }
}
