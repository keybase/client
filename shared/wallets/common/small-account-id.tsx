import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'

type SmallAccountIDProps = {
  accountID: Types.AccountID
  style?: Styles.StylesCrossPlatform
}

class SmallAccountID extends React.Component<SmallAccountIDProps, {expanded: boolean}> {
  state = {expanded: false}
  _expand = (evt: React.BaseSyntheticEvent) => {
    evt.stopPropagation()
    this.setState(s => (s.expanded ? null : {expanded: true}))
  }
  componentDidUpdate(prevProps: SmallAccountIDProps) {
    if (prevProps.accountID !== this.props.accountID && this.state.expanded) {
      this.setState({expanded: false})
    }
  }

  render() {
    return (
      <Kb.Text
        type="BodySmall"
        className={Styles.classNames({'hover-underline': !this.state.expanded})}
        selectable={this.state.expanded}
        style={Styles.collapseStyles([styles.text, this.props.style])}
        lineClamp={3}
        onClick={this._expand}
      >
        {this.state.expanded ? this.props.accountID : Constants.shortenAccountID(this.props.accountID)}
      </Kb.Text>
    )
  }
}

const styles = Styles.styleSheetCreate({
  text: {
    maxWidth: '100%',
  },
})

export default SmallAccountID
