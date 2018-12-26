// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
// import * as Types from '../constants/types/profile2'
import Assertion from '../assertion/container'
// import * as Styles from '../styles'

type Props = {|
  assertions: ?$ReadOnlyArray<string>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: ?string,
  location: ?string,
  publishedTeams: ?$ReadOnlyArray<string>,
  username: string,
|}

const Tracker = (props: Props) => {
  let assertions
  if (props.assertions) {
    assertions = props.assertions.map(a => <Assertion key={a} username={props.username} assertion={a} />)
  } else {
    // TODO could do a loading thing before we know about the list at all?
    assertions = null
  }
  return (
    <Kb.Box2 direction="vertical">
      <Kb.Text type="Body">TODO</Kb.Text>
      {assertions}
    </Kb.Box2>
  )
}

export default Tracker
