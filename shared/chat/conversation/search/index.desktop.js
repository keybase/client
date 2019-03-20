// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './index.types'

class ThreadSearch extends React.Component<Props> {
  _inputRef = React.createRef()
  _submitSearch = () => {
    this._inputRef.current && this.props.onSearch(this._inputRef.current.getValue())
  }
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.inputContainer} fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} centerChildren={true}>
            <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} fontSize={16} />
            <Kb.Input
              hideUnderline={true}
              hintText="Search..."
              small={true}
              uncontrolled={true}
              onEnterKeyDown={this._submitSearch}
              ref={this._inputRef}
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
            {this.props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
            {this.props.totalResults > 0 && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {this.props.selectedResult} of {this.props.totalResults}
                </Kb.Text>
                <Kb.Icon
                  color={Styles.globalColors.black_50}
                  fontSize={16}
                  onClick={this.props.onUp}
                  type="iconfont-arrow-up"
                />
                <Kb.Icon
                  color={Styles.globalColors.black_50}
                  fontSize={16}
                  onClick={this.props.onDown}
                  type="iconfont-arrow-down"
                />
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Button
          type="Primary"
          disabled={this.props.inProgress}
          onClick={this._submitSearch}
          label="Search"
        />
        <Kb.Button
          type="Secondary"
          disabled={!this.props.inProgress}
          onClick={this.props.onCancel}
          label="Cancel"
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  inputContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    justifyContent: 'space-between',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  outerContainer: {
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.tiny,
  },
  progress: {
    height: 14,
  },
  results: {
    color: Styles.globalColors.black_40,
  },
  resultsContainer: {
    flexShrink: 0,
  },
})

export default ThreadSearch
