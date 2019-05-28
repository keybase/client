// @noflow
const inject = () => {
  // Monkeypatch redux connect
  const redux = require('react-redux')
  const connect = require('../__mocks__/react-redux').connect
  redux.connect = connect
}

export {inject}
