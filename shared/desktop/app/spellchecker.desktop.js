// @flow
import {SpellCheckHandler, ContextMenuListener, ContextMenuBuilder} from 'electron-spellchecker'

export default function load() {
  const handler = new SpellCheckHandler()
  handler.attachToInput()
  handler.switchLanguage(navigator.language || 'en-US')

  const contextMenuBuilder = new ContextMenuBuilder(handler)
  // eslint-disable-next-line no-new
  new ContextMenuListener(info => {
    contextMenuBuilder.showPopupMenu(info)
  })
}
