import * as React from 'react'
import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBold: boolean
  usernameColor?: string
}

class FilteredTopLine extends React.PureComponent<Props> {
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
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text
          type="BodySemibold"
          lineClamp={1}
          style={Kb.Styles.collapseStyles([
            this.props.showBold && styles.boldOverride,
            styles.usernames,
            {color: this.props.usernameColor} as any,
          ])}
        >
          {this.props.participants.join(', ')}
        </Kb.Text>
        {!!this.props.numSearchHits && (
          <Kb.Text
            type="BodySmall"
            style={Kb.Styles.collapseStyles([this.props.isSelected && styles.selectedText])}
          >
            {this._getSearchHits()} {pluralize('result', this.props.numSearchHits)}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  boldOverride: {
    ...Kb.Styles.globalStyles.fontBold,
  },
  selectedText: {
    color: Kb.Styles.globalColors.white,
  },
  usernames: {
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
}))

export {FilteredTopLine}
