import React, {Component} from '../base-react'
import Select from 'react-select'

export default class Search extends Component {
  constructor (props) {
    super(props)

    this.state = {
      search: props.term
    }
  }

  buildRows (results) {
    console.log('results: ', results)
    const rows = !results ? [] : results.map(s => {
      const {username} = s
      const row1 = `${username}${this.fullNameFromComponent(s)}`
      const row2 = s.components.map(c => this.userComponentText(c)).filter(c => c).join(' | ')
      return {row1, row2, username}
    })
    return rows
  }

  onServiceResponse (response) {
    let rows = this.buildRows(response.results)
    console.log('Rows: ', rows)
    let options = rows.map(rowData => {
      return {value: rowData.username, label: rowData.username, row1: rowData.row1, row2: rowData.row2}
    })
    this.state.callback(null, {options: options, complete: false})
  }

  fullNameFromComponent (s) {
    return s.components.filter(c => c.key === 'full_name').map(c => ` [${c.value}] `).join('')
  }

  userComponentText (c) {
    switch (c.key) {
      case 'username':
      case 'full_name':
        return null
      case 'key_fingerprint':
        return `PGP: ${c.value.substring(0, 5)}...`
      default:
        return `${c.value}@${c.key}`
    }
  }

  renderRow (rowData, sectionID, rowID) {
    return (
      <a href='#' className='list-group-item' key={rowData.username}>
        <h5 className='list-group-item-heading'>{rowData.row1}</h5>
        <p className='list-group-item-text'>{rowData.row2}</p>
      </a>
    )
  }

  loadOptions (input, callback) {
    this.state.callback = callback

    var response = this.onServiceResponse.bind(this)
    // Send request (mock)
    setTimeout(function () {
      console.log('Input: ', input)
      if (input !== '') {
        response(mockResults)
      }
    }, 1000)
  }

  renderOption (option) {
    return <span><strong>{option.row1}</strong><br/>{option.row2}</span>
  }

  // This is a workaround for a bug in Select.
  // Using a no-op filterOptions seems to fix it from resetting
  filterOptions (options, filter, values) {
    if (!options) options = []
    return options
  }

  render () {
    return (
      <div style={styles.container}>
        <Select
          filterOptions={this.filterOptions}
          value={this.state.search}
          searchingText='Searching...'
          asyncOptions={this.loadOptions.bind(this)}
          cacheAsyncResults={false}
          autoload={false}
          style={styles.item}
          optionRenderer={this.renderOption}
          placeholder='Search for a user'
          multi
          />
      </div>
    )
  }
}

Search.propTypes = {
  term: React.PropTypes.string
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: 20
  },
  item: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  }
}

const mockResults = {'results': [{
  'components': [{
    'key': 'hackernews',
    'score': 0.025,
    'value': 'gak'
  }, {
    'key': 'coinbase',
    'score': 0.025,
    'value': 'gak'
  }, {
    'key': 'websites',
    'score': 0,
    'value': 'https://geraldkaszuba.com'
  }, {
    'key': 'username',
    'score': 0.0275,
    'value': 'gak'
  }, {
    'key': 'key_fingerprint',
    'score': 0,
    'value': '01978227f2d23612842863cb9b7e7646dcc17878'
  }, {
    'key': 'twitter',
    'score': 0.01428571428571429,
    'value': 'gakman'
  }, {
    'key': 'github',
    'score': 0.025,
    'value': 'gak'
  }, {
    'key': 'reddit',
    'score': 0.01428571428571429,
    'value': 'gakman'
  }],
  'username': 'gak',
  'score': 0.1310714285714286,
  'uid': '867f25932133caa86e77fe15e2a81a00'
}, {
  'components': [{
    'key': 'full_name',
    'score': 0,
    'value': 'Gustav Tonér'
  }, {
    'key': 'twitter',
    'score': 0.01428571428571429,
    'value': 'gazab_'
  }, {
    'key': 'github',
    'score': 0.01666666666666667,
    'value': 'gazab'
  }, {
    'key': 'coinbase',
    'score': 0.01666666666666667,
    'value': 'gazab'
  }, {
    'key': 'username',
    'score': 0.01833333333333333,
    'value': 'gazab'
  }, {
    'key': 'key_fingerprint',
    'score': 0,
    'value': '285c553296258835c3293b2e06f8dcd19e05e7e4'
  }, {
    'key': 'reddit',
    'score': 0.01666666666666667,
    'value': 'gazab'
  }, {
    'key': 'hackernews',
    'score': 0.01666666666666667,
    'value': 'gazab'
  }, {
    'key': 'websites',
    'score': 0.01111111111111111,
    'value': 'dns://gazab.se'
  }],
  'username': 'gazab',
  'score': 0.1103968253968254,
  'uid': 'c2ba13f67d9857b32c5a4634e8997500'
}]}
