import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as child_process from 'child_process'

export default () => {
  try {
    const patches = fs.readdirSync(path.join(__dirname, '../../patches'))
    patches.forEach(patch => {
      const decoded = decodeURIComponent(patch)
      const filenamePlusHash = path.basename(decoded)
      const parts = filenamePlusHash.split('.')
      const hash = parts.pop()
      const filename = parts.join('.')
      const fullDir = path.join(__dirname, '../../node_modules', path.dirname(decoded))
      const fullPath = path.join(fullDir, filename)

      const toMatchHash = crypto
        .createHash('md5')
        .update(fs.readFileSync(fullPath, {encoding: 'utf8'}))
        .digest('hex')

      if (hash === toMatchHash) {
        console.log(`Applying patch: ${fullPath} (${hash})`)
        const patchFullPath = path.join(__dirname, '../../patches', patch)
        const command = `git apply ${patchFullPath}`
        child_process.execSync(command, {cwd: fullDir, encoding: 'utf8', env: process.env, stdio: 'inherit'})
      } else {
        console.log('Skipping patch: ', fullPath, hash)
      }
    })
  } catch (e) {
    console.error('Patcher failed', e)
  }
}
