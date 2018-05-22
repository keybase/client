require('electron').ipcRenderer.once('load', (event, options) => {
  document.title = options.windowTitle || document.title
  options.scripts.map(({src, async, defer}) => {
    const script = document.createElement('script')
    if (src == null) {
      throw new Error('No src for script. Nothing to load')
    }
    script.src = src
    async != null && (script.async = async)
    defer != null && (script.defer = defer)
    script.onload = () => window.load && window.load(options)
    script.onerror = e => console.warn('error loading initial scripts:', e)
    document.head.appendChild(script)
  })
})
