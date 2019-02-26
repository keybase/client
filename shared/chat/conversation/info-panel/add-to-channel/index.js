// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {smartPluralize} from '../../../../util/string'

type Props = {|
  onCancel: () => void,
  onSubmit: (usernames: Array<string>) => void,
  title: string,
  users: Array<{alreadyAdded: boolean, fullname: string, username: string}>,
|}

type State = {|
  selected: I.Set<string>,
|}

class AddToChannel extends React.Component<Props, State> {
  state = {selected: I.Set()}
  _itemHeight = {
    height: Styles.isMobile ? 48 : 40,
    type: 'fixed',
  }

  _toggleSelected = username =>
    this.setState(s => ({
      selected: s.selected.includes(username) ? s.selected.remove(username) : s.selected.add(username),
    }))

  _renderItem = (idx, user) => (
    <Kb.ListItem2
      {...(user.alreadyAdded ? {} : {onClick: () => this._toggleSelected(user.username)})}
      firstItem={idx === 0}
      type="Small"
      icon={<Kb.Avatar username={user.username} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.ConnectedUsernames colorFollowing={true} type="BodySemibold" usernames={[user.username]} />
            {!user.alreadyAdded && !!user.fullname && (
              <Kb.Text lineClamp={1} type="BodySmall" style={styles.userSubtext}>
                {user.fullname}
              </Kb.Text>
            )}
            {user.alreadyAdded && (
              <Kb.Text lineClamp={1} ellipsizeMode="head" type="BodySmall" style={styles.userSubtext}>
                {user.username} is already a member
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        <Kb.Checkbox
          disabled={user.alreadyAdded}
          checked={user.alreadyAdded || user.selected}
          onCheck={() => this._toggleSelected(user.username)}
        />
      }
    />
  )

  render() {
    const items = this.props.users.map(u => ({...u, selected: this.state.selected.includes(u.username)}))
    return (
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        style={styles.container}
        gap="medium"
      >
        {!Styles.isMobile && <Kb.Text type="Header">{this.props.title}</Kb.Text>}
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={{flex: 1}}>
          <Kb.BoxGrow style={styles.listContainer}>
            <Kb.List2
              style={styles.list}
              items={items}
              keyProperty="username"
              renderItem={this._renderItem}
              itemHeight={this._itemHeight}
            />
          </Kb.BoxGrow>
          <Kb.ButtonBar direction="row">
            {!Styles.isMobile && <Kb.Button type="Secondary" label="Cancel" onClick={this.props.onCancel} />}
            <Kb.Button
              disabled={!this.state.selected.size}
              type="Primary"
              label={
                this.state.selected.size
                  ? `Add ${this.state.selected.size} ${smartPluralize('user', this.state.selected.size)}`
                  : 'Add'
              }
              onClick={() => this.props.onSubmit(this.state.selected.toArray())}
            />
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {height: 400, padding: Styles.globalMargins.small, width: 400},
    isMobile: {
      ...Styles.padding(0, 0, Styles.globalMargins.small, 0),
    },
  }),
  list: Styles.platformStyles({
    isMobile: {paddingTop: Styles.globalMargins.small},
  }),
  listContainer: {width: '100%'},
  userSubtext: Styles.platformStyles({
    common: {
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default Kb.HeaderOrPopup(AddToChannel)
