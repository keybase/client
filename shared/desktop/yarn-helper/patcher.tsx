import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as child_process from 'child_process'

const modulesRoot = path.join(__dirname, '../../node_modules')

export default () => {
  try {
    const patches = fs.readdirSync(path.join(__dirname, '../../patches'))
    patches.forEach(patch => {
      if (patch === 'README.md') return
      const decoded = decodeURIComponent(patch)
      const filenamePlusHash = path.basename(decoded)
      const parts = filenamePlusHash.split('.')
      const hash = parts.pop()
      const filename = parts.join('.')
      const fullDir = path.join(__dirname, '../../node_modules', path.dirname(decoded))
      const fullPath = path.join(fullDir, filename)

      // sanity check path
      const rel = path.relative(modulesRoot, fullPath)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        console.log('Skipping patch due to rel: ', fullPath, rel)
      }

      const toMatchHash = crypto
        .createHash('md5')
        .update(fs.readFileSync(fullPath, {encoding: 'utf8'}))
        .digest('hex')

      if (hash === toMatchHash) {
        console.log(`Applying patch: ${fullPath} (${hash})`)
        const patchFullPath = path.join(__dirname, '../../patches', patch)
        const command = `patch -p1 < ${patchFullPath}`
        child_process.execSync(command, {cwd: fullDir, encoding: 'utf8', env: process.env, stdio: 'inherit'})
        console.log('Patch applied')
      } else {
        console.log('Skipping patch: ', fullPath, hash)
      }
    })
  } catch (e) {
    console.error('Patcher failed', e)
  }
}
