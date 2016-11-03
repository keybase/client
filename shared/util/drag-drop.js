// @flow

function disable () {
  document.addEventListener('dragover', event => event.preventDefault())
  document.addEventListener('drop', event => event.preventDefault())
}

export {
  disable,
}
