// @flow
import {namedConnect} from '../../util/container'
import * as Platforms from '../../constants/platform'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'

type Props = {|
  filter: string,
  gap?: ?$Keys<typeof Styles.globalMargins>,
  onUpdate: string => void,
  path: Types.Path,
|}

type State = {|
  editing: boolean,
|}

const KeyHandler = (Platforms.isMobile ? c => c : require('../../util/key-handler.desktop').default)(
  () => null
)

class FolderViewFilter extends React.PureComponent<Props, State> {
  state = {editing: false}

  _input = React.createRef()

  _onBlur = () => this.setState({editing: false})
  _onFocus = () => this.setState({editing: true})
  _onHotkey = (cmd: string) => {
    cmd.endsWith('+f') && this._input.current && this._input.current.focus()
  }
  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    if (e.key === 'Escape' && !isComposingIME) {
      this.props.onUpdate('')
      this._input.current && this._input.current.blur()
    }
  }

  // Clear the filter if path changes, or if we get unmounted.
  componentDidUpdate(prevProps) {
    prevProps.path !== this.props.path && this.props.onUpdate('')
  }
  componentWillUnmount() {
    this.props.onUpdate('')
  }

  render() {
    return (
      Types.getPathLevel(this.props.path) > 1 && (
        <Kb.Box2
          direction="horizontal"
          style={Styles.collapseStyles([
            styles.container,
            !this.state.editing && styles.dark,
            this.props.gap && {
              marginLeft: Styles.globalMargins[this.props.gap],
              marginRight: Styles.globalMargins[this.props.gap],
            },
          ])}
          centerChildren={true}
          gap="tiny"
          gapStart={true}
          gapEnd={true}
        >
          <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_35} sizeType="Default" />
          <KeyHandler onHotkey={this._onHotkey} hotkeys={Platforms.isDarwin ? ['command+f'] : ['ctrl+f']} />
          <Kb.Input
            hideUnderline={true}
            small={true}
            value={this.props.filter}
            hintText="Filter ..."
            onChangeText={this.props.onUpdate}
            onBlur={this._onBlur}
            onFocus={this._onFocus}
            onKeyDown={this._onKeyDown}
            ref={this._input}
          />
          <Kb.Text
            type="BodySemibold"
            style={Styles.collapseStyles([styles.shortcutText, this.state.editing && styles.hidden])}
          >
            ({Platforms.shortcutSymbol}F)
          </Kb.Text>
        </Kb.Box2>
      )
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    borderRadius: Styles.borderRadius,
    padding: Styles.globalMargins.xtiny,
  },
  dark: {
    backgroundColor: Styles.globalColors.black_10,
  },
  hidden: {
    opacity: 0,
  },
  shortcutText: {
    color: Styles.globalColors.black_35,
  },
})

type OwnProps = {|
  path: Types.Path,
  gap?: ?$Keys<typeof Styles.globalMargins>,
|}

const mapStateToProps = state => ({
  filter: state.fs.folderViewFilter,
})
const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
})

const mergeProps = (s, d, o) => ({...o, ...s, ...d})

export default (Platforms.isMobile
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilter')(
      FolderViewFilter
    ))
