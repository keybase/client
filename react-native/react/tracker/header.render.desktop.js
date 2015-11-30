/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import path from 'path'
import commonStyles from '../styles/common'
import type {Styled} from '../styles/common'

export type HeaderProps = {
  reason: string,
  onClose: () => void
}

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render (): ReactElement {
    return (
      <div style={{...this.props.style, ...styles.container}}>
        <img style={styles.logo} src={`file:///${path.resolve('../react-native/react/images/service/keybase.png')}`}/>
        <p style={styles.reason}>{this.props.reason}</p>
        <i style={styles.close} className='fa fa-times' onTouchTap={() => this.props.onClose()}></i>
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
  },
  reason: {
    color: '#20C0EF',
    flex: 1
  },
  close: {
    ...commonStyles.clickable,
    color: '#D0D4DA'
  }
}
