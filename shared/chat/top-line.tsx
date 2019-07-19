import React, {PureComponent} from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {pluralize} from '../util/string'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBold: boolean
  usernameColor: string | null
}

class FilteredTopLine extends PureComponent<Props> {
  _getSearchHits = () => {
    if (!this.props.numSearchHits) {
      return ''
    }
    if (this.props.maxSearchHits) {
      return this.props.numSearchHits >= this.props.maxSearchHits
        ? `${this.props.numSearchHits}+`
        : `${this.props.numSearchHits}`
    }
    return `${this.props.numSearchHits}`
  }
  render() {
    return (
      <Kb.Box2 alignSelf="flex-start" direction="horizontal">
        <Kb.Box2 direction="vertical">
          <Kb.PlaintextUsernames
            type="BodySemibold"
            containerStyle={Styles.collapseStyles([
              this.props.showBold && styles.boldOverride,
              styles.usernames,
              {color: this.props.usernameColor},
            ])}
            users={this.props.participants.map(p => ({username: p}))}
            title={this.props.participants.join(', ')}
          />
          {!!this.props.numSearchHits && (
            <Kb.Text type="BodySmall" style={Styles.collapseStyles([
              this.props.isSelected && styles.selectedText,
            ])}>
              {this._getSearchHits()} {pluralize('result', this.props.numSearchHits)}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  boldOverride: {
    ...Styles.globalStyles.fontBold,
  },
  selectedText: {
    color: Styles.globalColors.white,
  },
  usernames: {
    paddingRight: Styles.globalMargins.tiny,
  },
})

export {FilteredTopLine}
