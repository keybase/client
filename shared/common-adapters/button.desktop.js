/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './button'
import flags from '../util/feature-flags'

export default class Button extends Component {
  props: Props;

  render1 () {
    const rootStyle = this.props.primary ? styles1.buttonPrimary : styles1.buttonSecondary
    const smallStyle = this.props.small ? styles1.buttonSmall : {}
    const smallLabelStyle = this.props.small ? styles1.buttonSmallLabel : {}
    const moreStyle = this.props.more ? styles1.buttonMore : {}
    const moreLabelStyle = this.props.more ? styles1.buttonMoreLabel : {}

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...smallStyle, ...moreStyle, ...this.props.style}}
        labelStyle={{...styles1.buttonLabel, ...smallLabelStyle, ...moreLabelStyle}}
        label={this.props.label || this.props.more && '•••'}
        primary={this.props.primary}
        secondary={this.props.secondary}
      />
    )
  }

  render () {
    if (!flags.tracker2) {
      return this.render1()
    }

    let backgroundStyle = {}
    let labelStyle = {}
    let widthStyle = {}
    let smallStyle = {}

    // First apply styles for the main button types.
    if (this.props.primary) {
      backgroundStyle = {
        ...styles2.buttonPrimary,
        opacity: this.props.disabled ? styles2.buttonPrimary.disabledOpacity : 1
      }
    } else if (this.props.follow) {
      backgroundStyle = {
        ...styles2.buttonFollow,
        opacity: this.props.disabled ? styles2.buttonFollow.disabledOpacity : 1
      }
    } else if (this.props.following) {
      backgroundStyle = {
        ...styles2.buttonFollowing,
        opacity: this.props.disabled ? styles2.buttonFollowing.disabledOpacity : 1
      }
      labelStyle = {
        color: globalColorsDZ2.green
      }
    } else if (this.props.unfollow) {
      backgroundStyle = {
        ...styles2.buttonUnfollow,
        opacity: this.props.disabled ? styles2.buttonUnfollow.disabledOpacity : 1
      }
    } else if (this.props.danger) {
      backgroundStyle = {
        ...styles2.buttonDanger,
        opacity: this.props.disabled ? styles2.buttonDanger.disabledOpacity : 1
      }
    } else {
      backgroundStyle = {
        ...styles2.buttonSecondary,
        opacity: this.props.disabled ? styles2.buttonSecondary.disabledOpacity : 1
      }
      labelStyle = {
        color: globalColorsDZ2.black75
      }
    }

    // Then some overrides that apply to all button types.
    if (this.props.small) {
      smallStyle = styles2.buttonSmall
      labelStyle = {
        ...labelStyle,
        ...styles2.buttonSmallLabel
      }
    }

    if (this.props.fullWidth) {
      backgroundStyle = {
        ...backgroundStyle,
        // Using minWidth here means we can't have a full-width button on the
        // same line/row as another button, the right thing is very unlikely to
        // happen.  The alternative is 'flex: 1' here, which would work but is
        // dangerous, because we'd be modifying our container.
        //
        // So let's just say that a fullWidth button can't have siblings.
        minWidth: '100%'
      }
    }

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...backgroundStyle, ...this.props.style, ...smallStyle, ...widthStyle}}
        labelStyle={{...styles2.buttonLabel, ...labelStyle}}
        label={this.props.label || this.props.more && '•••'}
        primary={this.props.primary}
        secondary={this.props.secondary}
        disabled={this.props.disabled}
      />
    )
  }
}

Button.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  label: React.PropTypes.string,
  style: React.PropTypes.object,
  primary: React.PropTypes.bool,
  secondary: React.PropTypes.bool,
  follow: React.PropTypes.bool,
  following: React.PropTypes.bool,
  unfollow: React.PropTypes.bool,
  danger: React.PropTypes.bool,
  small: React.PropTypes.bool,
  more: React.PropTypes.bool,
  disabled: React.PropTypes.bool,
  fullWidth: React.PropTypes.bool
}

const buttonCommon1 = {
  ...globalStyles.fontRegular,
  borderRadius: 61,
  color: globalColors.white,
  fontSize: 18,
  paddingTop: 4,
  paddingBottom: 4,
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

const buttonCommon2 = {
  ...globalStyles.DZ2.fontSemibold,
  color: globalColorsDZ2.white,
  borderRadius: 55,
  fontSize: 16,
  height: '32px',
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 100
}

export const styles2 = {
  buttonPrimary: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.blue,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonSecondary: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.lightGrey2,
    disabledOpacity: 0.3,
    marginRight: 10
  },
  buttonDanger: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.red,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonFollow: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.green,
    disabledOpacity: 0.3,
    marginRight: 10,
    minWidth: '125px'
  },
  buttonFollowing: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.white,
    border: 'solid 2px ' + globalColorsDZ2.green,
    marginRight: 10,
    minWidth: '125px'
  },
  buttonUnfollow: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.blue,
    disabledOpacity: 0.2,
    marginRight: 10,
    minWidth: '125px'
  },
  buttonSmall: {
    height: '28px',
    lineHeight: '24px'
  },
  buttonLabel: {
    paddingLeft: 25,
    paddingRight: 25
  },
  buttonSmallLabel: {
    ...globalStyles.DZ2.fontRegular,
    paddingLeft: 20,
    paddingRight: 20
  }
}

export const styles1 = {
  buttonPrimary: {
    ...buttonCommon1,
    backgroundColor: globalColors.green
  },
  buttonSecondary: {
    ...buttonCommon1,
    backgroundColor: globalColors.lightBlue,
    marginRight: 10
  },
  buttonSmall: {
    fontSize: 13,
    paddingTop: 3,
    paddingBottom: 3,
    lineHeight: '18px'
  },
  buttonLabel: {
    paddingLeft: 24,
    paddingRight: 24
  },
  buttonSmallLabel: {
    paddingLeft: 10,
    paddingRight: 10
  },
  buttonMore: {
    ...buttonCommon1,
    backgroundColor: globalColors.grey3,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 2,
    paddingBottom: 2,
    height: 12,
    lineHeight: '2px'
  },
  buttonMoreLabel: {
    paddingLeft: 3,
    paddingRight: 3,
    paddingTop: 3,
    paddingBottom: 3
  }
}
