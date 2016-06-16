import process from 'process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {execSync} from 'child_process'
import _ from 'lodash'
import gm from 'gm'
import github from 'octonode'

const BUCKET_S3 = 's3://keybase-app-visdiff'
const BUCKET_HTTP = 'http://keybase-app-visdiff.s3.amazonaws.com'
const MAX_INLINE_IMAGES = 6

const DIFF_NEW = 'new'
const DIFF_REMOVED = 'removed'
const DIFF_CHANGED = 'changed'
const DIFF_SAME = 'same'

const DRY_RUN = !!process.env['VISDIFF_DRY_RUN']

function packageHash () {
  return crypto.createHash('sha1').update(fs.readFileSync('package.json')).digest('hex')
}

function checkout (commit) {
  const origPackageHash = packageHash()
  execSync(`rm -rf node_modules.${origPackageHash} && mv node_modules node_modules.${origPackageHash}`)
  console.log(`Shelved node_modules to node_modules.${origPackageHash}.`)

  execSync(`git checkout -f ${commit}`)
  console.log(`Checked out ${commit}.`)

  const newPackageHash = packageHash()
  if (fs.existsSync(`node_modules.${newPackageHash}`)) {
    console.log(`Reusing existing node_modules.${newPackageHash} directory.`)
    execSync(`mv node_modules.${newPackageHash} node_modules`)
  } else {
    console.log(`Installing dependencies for package.json:${newPackageHash}...`)
    execSync('../packaging/npm_mess.sh', {stdio: 'inherit'})
  }
}

function renderScreenshots (commitRange) {
  for (const commit of commitRange) {
    checkout(commit)
    console.log(`Rendering screenshots of ${commit}`)
    execSync(`mkdir -p screenshots/${commit} && npm run render-screenshots -- screenshots/${commit}`, {stdio: 'inherit'})
  }
}

function compareScreenshots (commitRange, diffDir, callback) {
  const results = {}

  execSync(`mkdir -p screenshots/${diffDir}`)

  const files0 = fs.readdirSync(`screenshots/${commitRange[0]}`)
  const files1 = fs.readdirSync(`screenshots/${commitRange[1]}`)
  const files = _.union(files0, files1)
  function compareNext () {
    const filename = files.pop()
    if (!filename) {
      callback(commitRange, results)
      return
    }

    if (filename.startsWith('.')) {
      return
    }

    const diffPath = `screenshots/${diffDir}/${filename}`

    const oldPath = `screenshots/${commitRange[0]}/${filename}`
    if (!fs.existsSync(oldPath)) {
      results[diffPath] = DIFF_NEW
      compareNext()
      return
    }

    const newPath = `screenshots/${commitRange[1]}/${filename}`
    if (!fs.existsSync(newPath)) {
      results[diffPath] = DIFF_REMOVED
      compareNext()
      return
    }

    const compareOptions = {
      tolerance: 1e-6,  // leave a little wiggle room for antialiasing inconsistencies
      file: diffPath
    }
    gm.compare(oldPath, newPath, compareOptions, (err, isEqual) => {
      if (err) {
        console.log(err)
        process.exit(1)
      }
      results[diffPath] = isEqual ? DIFF_SAME : DIFF_CHANGED
      compareNext()
    })
  }
  compareNext()
}

function processDiff (commitRange, results) {
  const changedResults = []
  const newResults = []
  const removedResults = []
  Object.keys(results).forEach(filePath => {
    const result = results[filePath]
    if (result === DIFF_SAME) {
      // clean up results of identical diffs so they don't get uploaded to S3
      fs.unlinkSync(filePath)
    } else {
      // a difference was detected. include the before and after images, if they exist, in our upload set
      const filenameParts = path.parse(filePath, '.png')
      for (const commit of commitRange) {
        const fromFile = `screenshots/${commit}/${filenameParts.base}`
        if (fs.existsSync(fromFile)) {
          execSync(`cp ${fromFile} ${filenameParts.dir}/${filenameParts.name}-${commit}${filenameParts.ext}`)
        }
      }

      if (result === DIFF_CHANGED) {
        changedResults.push(filenameParts.name)
      } else if (result === DIFF_NEW) {
        newResults.push(filenameParts.name)
      } else if (result === DIFF_REMOVED) {
        removedResults.push(filenameParts.name)
      }
    }
  })

  const commentLines = []
  let imageCount = 0

  newResults.forEach(name => {
    const afterURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[1]}.png`
    const line = ` * Added: **${name}**`
    if (imageCount > MAX_INLINE_IMAGES) {
      commentLines.push(line + ` [(view)](${afterURL})`)
    } else {
      commentLines.push(line + '  ')
      commentLines.push(`   ![${name} rendered](${afterURL})`)
      imageCount++
    }
  })

  changedResults.forEach(name => {
    const diffURL = `${BUCKET_HTTP}/${diffDir}/${name}.png`
    const beforeURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[0]}.png`
    const afterURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[1]}.png`
    const line = ` * Changed: **${name}** [(before)](${beforeURL}) [(after)](${afterURL})`
    if (imageCount > MAX_INLINE_IMAGES) {
      commentLines.push(line + ` [(diff)](${diffURL})`)
    } else {
      commentLines.push(line + '  ')
      commentLines.push(`   ![${name} comparison](${diffURL})`)
      imageCount++
    }
  })

  removedResults.forEach(name => {
    const beforeURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[0]}.png`
    commentLines.push(` * Removed: **${name}** [(view original)](${beforeURL})`)
  })

  if (commentLines.length > 0) {
    commentLines.unshift(`:mag_right: The commits ${commitRange[0]}...${commitRange[1]} introduced some visual changes:`)
    const commentBody = commentLines.join('\n')

    if (!DRY_RUN) {
      const s3Env = {
        ...process.env,
        AWS_ACCESS_KEY_ID: process.env['VISDIFF_AWS_ACCESS_KEY_ID'],
        AWS_SECRET_ACCESS_KEY: process.env['VISDIFF_AWS_SECRET_ACCESS_KEY']
      }
      console.log(`Uploading ${diffDir} to ${BUCKET_S3}...`)
      execSync(`s3cmd put --acl-public -r screenshots/${diffDir} ${BUCKET_S3}`, {env: s3Env})
      console.log('Screenshots uploaded.')

      var ghClient = github.client(process.env['VISDIFF_GH_TOKEN'])
      var ghIssue = ghClient.issue('keybase/client', process.env['VISDIFF_PR_ID'])
      ghIssue.createComment({body: commentBody}, (err, res) => {
        if (err) {
          console.log('Failed to post visual diff on GitHub:', err.toString(), err.body)
          process.exit(1)
        }
        console.log('Posted visual diff on GitHub:', res.html_url)
      })
    } else {
      console.log(commentBody)
    }
  } else {
    console.log('No visual changes found as a result of these commits.')
  }
}

if (process.argv.length !== 3) {
  console.log(`Usage: node ${path.basename(process.argv[1])} COMMIT1..COMMIT2`)
  process.exit(1)
}

const commitRange = process.argv[2]
  .split(/\.{2,3}/)  // Travis gives us ranges like START...END
  .map(s => s.substr(0, 12))  // trim the hashes a bit for shorter paths

console.log(`Performing visual diff of ${commitRange[0]}...${commitRange[1]}:`)
const diffDir = `${Date.now()}-${commitRange[0]}-${commitRange[1]}`
renderScreenshots(commitRange)
compareScreenshots(commitRange, diffDir, processDiff)
