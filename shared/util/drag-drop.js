// @flow

function disable() {
  document.addEventListener('dragover', (event: DragEvent) => event.preventDefault())
  document.addEventListener('drop', (event: DragEvent) => event.preventDefault())
}

export {disable}
