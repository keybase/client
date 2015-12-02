/* @flow */

import React, {Component} from '../base-react'
import path from 'path'
import commonStyles from '../styles/common'
import type {Styled} from '../styles/common'

import type {HeaderProps} from './header.render.types'

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render (): ReactElement {
    return (
      <div style={{...this.props.style, ...styles.container}}>
        <img style={styles.logo} src={`file://${path.resolve(__dirname, '..', 'images', 'service' , 'keybase.png')}`}/>
        <p style={styles.reason}>{this.props.reason}</p>
        <div style={styles.close} onClick={() => this.props.onClose()}>
          <i className='fa fa-times' ></i>
        </div>
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
    ...commonStyles.windowDragging,
    paddingLeft: 15,
    paddingRight: 9,
    alignItems: 'center'
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 7
  },
  reason: {
    color: '#20C0EF',
    flex: 1
  },
  close: {
    ...commonStyles.clickable,
    ...commonStyles.windowDraggingClickable,
    color: '#D0D4DA'
  }
}
