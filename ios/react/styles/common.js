var StyleSheet = require('react-native').StyleSheet

module.exports = StyleSheet.create({
  button: {
    textAlign: 'center',
    color: 'black',
    marginBottom: 10,
    padding: 10,
    borderColor: 'blue',
    borderRadius: 2,
    backgroundColor: '#eeeeee'
  }
})

// non stylesheet styles
module.exports.buttonHighlight = 'white'
