import React, {Component} from '../base-react'
import resolveAssets from '../../../desktop/resolve-assets'
import {globalStyles, globalColors} from '../styles/style-guide'
import {autoResize} from '../native/remote-component-helper'
import {Checkbox, Header, Input, Text, Button} from '../common-adapters'

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

  componentDidMount () {
    autoResize()
  }

  render () {
    const submitPassphrase = () => this.props.onSubmit(this.state.passphrase, this.state.features)
    return (
      <div style={{...globalStyles.flexBoxColumn, alignItems: 'center', justifyContent: 'center', backgroundColor: 'blue'}}>
        <div style={styles.container}>
          <Header
            style={styles.header}
            title={this.props.windowTitle}
            onClose={() => this.props.onCancel()}
          />
          <div style={styles.bodyContainer}>
            <img style={styles.logo} src={`file:///${resolveAssets('../react-native/react/images/service/keybase.png')}`}/>
            <div style={styles.body}>
              <p style={styles.prompt}>{this.props.prompt}</p>
              <div style={styles.checkContainer}>
                <Text style={styles.hint} type='Body' small>Your key passphrase:</Text>
                {Object.keys(this.props.features).map(feature => {
                  return (
                    <Checkbox
                      style={styles.checkbox}
                      key={feature}
                      name={feature}
                      checked={this.state.features[feature]}
                      label={this.props.features[feature].label}
                      onCheck={checked => this.onCheck(feature, checked)}/>
                  )
                })}
              </div>
              <Input
                style={styles.input}
                onChange={e => this.setState({passphrase: e.target.value})}
                value={this.state.passphrase}
                type={this.state.showTyping ? 'text' : 'password'}
                onEnterKeyDown={submitPassphrase}
                autoFocus
              />
              <Text type='Error'>{this.props.retryLabel}</Text>
            </div>
          </div>
          <div style={styles.action}>
            <Button label={this.props.cancelLabel || 'Cancel'} onClick={() => this.props.onCancel()} />
            <Button primary label={this.props.submitLabel || 'Close'} onClick={submitPassphrase} />
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
    ...globalStyles.flexBoxColumn,
    ...globalStyles.fontRegular,
    backgroundColor: 'white',
    fontSize: 15,
    width: 513
  },
  header: {
    height: 34
  },
  bodyContainer: {
    ...globalStyles.flexBoxRow,
    paddingLeft: 9,
    paddingRight: 15,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: globalColors.grey5
  },
  body: {
    ...globalStyles.flexBoxColumn,
    position: 'relative',
    flex: 1
  },
  action: {
    ...globalStyles.flexBoxRow,
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
    ...globalStyles.flexBoxRow,
    justifyContent: 'flex-end',
    marginTop: 22,
    marginBottom: 2,
    flex: 1
  },
  hint: {
    flex: 1,
    color: globalColors.black
  },
  checkbox: {
    ...globalStyles.topMost,
    color: globalColors.black,
    marginLeft: 10
  },
  input: {
    width: 'initial',
    height: 'initial',
    marginBottom: 2
  }
}
