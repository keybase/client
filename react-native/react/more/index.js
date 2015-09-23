'use strict'

const React = require('react-native')
const {
  Component,
  ListView,
  StyleSheet,
  View,
  Text,
  TouchableHighlight
} = React

const commonStyles = require('../styles/common')
const LoginActions = require('../actions/login')

class More extends Component {
  constructor (props) {
    super(props)
  }

  componentWillMount () {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    this.state = {
      dataSource: ds.cloneWithRows([
        {name: 'Sign Out', onClick: () => {
          this.props.dispatch(LoginActions.logout())
        }},
        {name: 'About', hasChildren: true, onClick: () => {
          this.props.navigator.push({ title: 'About', component: require('./about') })
        }},
        {name: 'Developer', hasChildren: true, onClick: () => {
          this.props.navigator.push({ title: 'Developer', component: require('./developer') })
        }}
      ])
    }
  }

  select ({onClick}) {
    onClick()
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={styles.separator} /> : null

    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => { this.select(rowData) }}>
        <View>
          <View style={{margin: 10, flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
            <Text>{rowData.name}</Text>
            <Text>{rowData.hasChildren ? '>' : ''}</Text>
          </View>
          {sep}
        </View>
      </TouchableHighlight>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        <ListView style={{}}
        dataSource={this.state.dataSource}
        renderRow={(...args) => { return this.renderRow(...args) }}
        />
      </View>
    )
  }
}

More.propTypes = {
  navigator: React.PropTypes.object,
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
    marginTop: 60
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
  }
})

module.exports = More
