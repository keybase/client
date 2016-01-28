import React, {Component} from '../base-react'
import Search from '../search/index.desktop'

export default class PeopleRender extends Component {
  render () {
    return (
      <div>
        <Search />

        <p> People goes here </p>
        <p> Count: 0</p>
        <p> I mean, it’s one banana, Michael. What could it cost? Ten dollars? </p>
      </div>
    )
  }
}
