import React, {Component} from '../base-react'
import {TextField, FlatButton, Checkbox} from 'material-ui'
import Header from '../common-adapters/header'
import path from 'path'

import commonStyles, {colors} from '../styles/common'

export default class PinentryRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      passphrase: '',
      features: {},
      showTyping: false
    }
    for (const feature in this.props.features) {
      this.state.features[feature] = this.props.features[feature].defaultValue

      if (feature === 'showTyping') {
        this.state.showTyping = this.props.features[feature].defaultValue
      }
    }
  }

  onCheck (feature, checked) {
    this.setState({
      features: {
        ...this.state.features,
        [feature]: checked
      }
    })

    if (feature === 'showTyping') {
      this.setState({showTyping: checked})
    }
  }

  render () {
    return (
      <div style={{...commonStyles.flexBoxColumn, alignItems: 'center', justifyContent: 'center', backgroundColor: 'blue'}}>
        <div style={styles.container}>
          <Header
            style={styles.header}
            title={this.props.windowTitle}
            onClose={() => this.props.onCancel()}
          />
          <div style={styles.bodyContainer}>
            <img style={styles.logo} src={`file:///${path.resolve('../react-native/react/images/service/keybase.png')}`}/>
            <div style={styles.body}>
              <p style={styles.prompt}>{this.props.prompt}</p>
              <div style={styles.checkContainer}>
                {Object.keys(this.props.features).map(feature => {
                  return (
                  <div>
                    <Checkbox
                      labelStyle={styles.checkLabel}
                      iconStyle={styles.checkIcon}
                      key={feature}
                      name={feature}
                      value={feature}
                      label={this.props.features[feature].label}
                      defaultChecked={this.props.features[feature].defaultValue}
                      style={styles.checkbox}
                      onCheck={(_, checked) => this.onCheck(feature, checked)}/>
                  </div>
                  )
                })}
              </div>
              <TextField
                style={styles.input}
                onChange={e => this.setState({passphrase: e.target.value})}
                floatingLabelText='Your passphrase'
                value={this.state.passphrase}
                type={this.state.showTyping ? 'text' : 'password'}
                autoFocus />
              <p style={styles.error}>{this.props.retryLabel}</p>
            </div>
          </div>
          <div style={styles.action}>
            <FlatButton style={commonStyles.secondaryButton} label={this.props.cancelLabel || 'Cancel'} onClick={() => this.props.onCancel()} />
            <FlatButton style={commonStyles.primaryButton} label={this.props.submitLabel || 'Close'} primary onClick={() => this.props.onSubmit(this.state.passphrase, this.state.features)} />
          </div>
        </div>
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  features: React.PropTypes.object.isRequired,
  prompt: React.PropTypes.string.isRequired,
  retryLabel: React.PropTypes.string.isRequired,
  cancelLabel: React.PropTypes.string,
  submitLabel: React.PropTypes.string,
  windowTitle: React.PropTypes.string.isRequired
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    backgroundColor: 'white',
    fontFamily: 'Noto Sans',
    fontSize: 15,
    width: 513
  },
  header: {
    height: 34
  },
  bodyContainer: {
    ...commonStyles.flexBoxRow,
    paddingLeft: 9,
    paddingRight: 15,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: colors.greyBackground
  },
  error: {
    height: 21,
    color: colors.error,
    margin: 0
  },
  body: {
    ...commonStyles.flexBoxColumn,
    position: 'relative',
    flex: 1
  },
  action: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 49,
    paddingTop: 9,
    paddingBottom: 9,
    paddingRight: 15
  },
  logo: {
    width: 49,
    height: 49,
    marginRight: 14
  },
  prompt: {
    marginTop: 0
  },
  checkContainer: {
    ...commonStyles.flexBoxRow,
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    bottom: 55
  },
  checkbox: {
    marginTop: 30,
    marginLeft: 10
  },
  checkLabel: {
    ...commonStyles.noWrapCheckboxLabel,
    fontSize: 13
  },
  checkIcon: {
    marginRight: 4
  },
  input: {
    width: 'initial'
  }
}
