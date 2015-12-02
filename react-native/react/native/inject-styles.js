const isDev = process.env.NODE_ENV === 'development'

export default function (document, path) {
  // workaround for injections from node_modules. in packaging node_modules is moved to the root and not under desktop
  if (!isDev) {
    path = path.replace('/desktop/node_modules/', '/node_modules/')
  }

  var ss = document.createElement('link')
  ss.type = 'text/css'
  ss.rel = 'stylesheet'
  ss.href = path
  document.getElementsByTagName('head')[0].appendChild(ss)
}
