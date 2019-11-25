import React, {PureComponent} from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Constants from '../constants/chat2'
import {TeamAvatar} from './avatars'
import {pluralize} from '../util/string'
import {BottomLine} from './inbox/row/small-team/bottom-line'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  teamname: string
  channelname: string
  onSelectConversation: () => void
  showBadge: boolean
  showBold: boolean
  snippet: string | null
  snippetDecoration: RPCChatTypes.SnippetDecoration
}

type State = {
  isHovered: boolean
}

class SelectableBigTeamChannel extends PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})
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
    const boldOverride = this.props.showBold ? Styles.globalStyles.fontBold : null
    const subColor = Constants.getRowStyles(this.props.isSelected, false).subColor
    const rowLoadedContent = (
      <>
        <TeamAvatar
          teamname={this.props.teamname}
          isMuted={false}
          isSelected={false}
          isHovered={this.state.isHovered}
        />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Text
              type="Body"
              style={Styles.collapseStyles([
                styles.teamname,
                {color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black},
              ])}
              title={this.props.teamname}
              lineClamp={Styles.isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              {this.props.teamname}
            </Kb.Text>
            <Kb.Text
              type="Body"
              style={Styles.collapseStyles([
                boldOverride,
                styles.channelname,
                {color: this.props.isSelected ? Styles.globalColors.white : Styles.globalColors.black},
              ])}
              title={`#${this.props.channelname}`}
              lineClamp={Styles.isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              &nbsp;#
              {this.props.channelname}
            </Kb.Text>
          </Kb.Box2>
          {!this.props.numSearchHits && (
            <BottomLine
              participantNeedToRekey={false}
              showBold={false}
              subColor={subColor}
              snippet={this.props.snippet}
              snippetDecoration={this.props.snippetDecoration}
              youNeedToRekey={false}
              youAreReset={false}
              hasResetUsers={false}
              isSelected={this.props.isSelected}
              isDecryptingSnippet={false}
              isTypingSnippet={false}
            />
          )}
          {!!this.props.numSearchHits && (
            <Kb.Text
              type="BodySmall"
              style={Styles.collapseStyles([this.props.isSelected && styles.selectedText])}
            >
              {this._getSearchHits()} {pluralize('result', this.props.numSearchHits)}
            </Kb.Text>
          )}
        </Kb.Box2>
        {this.props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
      </>
    )
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          className="hover_background_color_blueGreyDark"
          style={Styles.collapseStyles([
            styles.filteredRow,
            {backgroundColor: this.props.isSelected ? Styles.globalColors.blue : Styles.globalColors.white},
          ])}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          {this.props.teamname ? rowLoadedContent : <Kb.ProgressIndicator type="Small" />}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

export const rowHeight = Styles.isMobile ? 64 : 56

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        backgroundColor: Styles.globalColors.orange,
        borderRadius: 6,
        flexShrink: 0,
        height: Styles.globalMargins.tiny,
        width: Styles.globalMargins.tiny,
      },
      channelname: Styles.platformStyles({
        // TODO: tweak this so that they take up full space in popup
        common: {
          flexShrink: 0,
          maxWidth: '70%',
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      filteredRow: {
        height: rowHeight,
        paddingLeft: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      selectedText: {
        color: Styles.globalColors.white,
      },
      teamname: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
          flexShrink: 1,
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      textContainer: {
        flexShrink: 1,
        overflow: 'hidden',
        paddingRight: Styles.globalMargins.tiny,
      },
    } as const)
)

export default SelectableBigTeamChannel
