// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'

type SmallAccountIDProps = {
  accountID: Types.AccountID,
}

class SmallAccountID extends React.Component<SmallAccountIDProps, {expanded: boolean}> {
  state = {expanded: false}
  _text = React.createRef()
  _expand = () => {
    this.setState(s => (s.expanded ? null : {expanded: true}))
    this._text.current && this._text.current.highlightText()
  }

  componentDidUpdate(prevProps: SmallAccountIDProps) {
    if (prevProps.accountID !== this.props.accountID && this.state.expanded) {
      this.setState({expanded: false})
    }
  }

  render() {
    return (
      <Kb.Text
        allowHighlightText={true}
        type="BodySmall"
        ref={this._text}
        className={this.state.expanded ? '' : 'hover-underline'}
        selectable={this.state.expanded}
        onClick={this.state.expanded ? null : () => this._expand()}
      >
        {this.state.expanded ? this.props.accountID : Constants.shortenAccountID(this.props.accountID)}
      </Kb.Text>
    )
  }
}

export default SmallAccountID
