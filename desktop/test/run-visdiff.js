import process from 'process'
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import gm from 'gm'
import github from 'octonode'

const BUCKET_S3 = 's3://keybase-app-visdiff'
const BUCKET_HTTP = 'http://keybase-app-visdiff.s3.amazonaws.com'
const MAX_INLINE_IMAGES = 6

function renderScreenshots (commitRange) {
  for (const commit of commitRange) {
    console.log(`Rendering screenshots of ${commit}`)
    execSync(`git checkout -f ${commit} && mkdir -p screenshots/${commit} && npm run render-screenshots -- screenshots/${commit}`)
  }
  execSync(`git checkout -f ${commitRange[1]}`)
}

function compareScreenshots (commitRange, diffDir, callback) {
  const results = {}

  execSync(`mkdir -p screenshots/${diffDir}`)

  const files = fs.readdirSync(`screenshots/${commitRange[0]}`)
  function compareNext () {
    const filename = files.pop()
    if (!filename || filename.startsWith('.')) {
      callback(results)
      return
    }

    const oldPath = `screenshots/${commitRange[0]}/${filename}`
    const newPath = `screenshots/${commitRange[1]}/${filename}`
    const diffPath = `screenshots/${diffDir}/${filename}`
    const compareOptions = {
      tolerance: 1e-6,  // leave a little wiggle room for antialiasing inconsistencies
      file: diffPath
    }

    gm.compare(oldPath, newPath, compareOptions, (err, isEqual) => {
      if (err) {
        console.log(err)
        process.exit(1)
      }
      results[diffPath] = isEqual
      compareNext()
    })
  }
  compareNext()
}

if (process.argv.length !== 3) {
  console.log('Usage: node run-visdiff COMMIT1..COMMIT2')
  process.exit(1)
}

const commitRange = process.argv[2]
  .split(/\.{2,3}/)  // TRAVIS gives us ranges like START...END
  .map(s => s.substr(0, 12))  // trim the hashes a bit for shorter paths

// we want to compare with commit prior to the first in the range
commitRange[0] += '^'

const diffDir = `${Date.now()}-${commitRange[0]}-${commitRange[1]}`
renderScreenshots(commitRange)
compareScreenshots(commitRange, diffDir, results => {
  const changed = []
  Object.keys(results).forEach(filePath => {
    if (results[filePath] === true) {
      // the compared images are equal. clean up uninteresting renders.
      fs.unlinkSync(filePath)
    } else {
      // a difference was detected. include the before and after images in our upload set.
      const filenameParts = path.parse(filePath, '.png')
      for (const commit of commitRange) {
        execSync(`cp screenshots/${commit}/${filenameParts.base} ${filenameParts.dir}/${filenameParts.name}-${commit}${filenameParts.ext}`)
      }
      changed.push(filenameParts.name)
    }
  })

  const s3Env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: process.env['VISDIFF_AWS_ACCESS_KEY_ID'],
    AWS_SECRET_ACCESS_KEY: process.env['VISDIFF_AWS_SECRET_ACCESS_KEY']
  }
  console.log(`Uploading ${diffDir} to ${BUCKET_S3}...`)
  execSync(`s3cmd put --acl-public -r screenshots/${diffDir} ${BUCKET_S3}`, {env: s3Env})
  console.log('Screenshots uploaded.')

  var ghClient = github.client(process.env['VISDIFF_GH_TOKEN'])
  var ghIssue = ghClient.issue('keybase/client', process.env['TRAVIS_PULL_REQUEST'])

  let commentBody
  if (changed.length === 0) {
    commentBody = ':mag_right: No visual changes found in stateless components.'
  } else {
    let imageCount = 0
    const commentLines = []
    commentLines.push(':mag_right: :zap: Some components look different as a result of this changeset:\n')
    changed.forEach(name => {
      const diffURL = `${BUCKET_HTTP}/${diffDir}/${name}.png`
      const beforeURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[0]}.png`
      const afterURL = `${BUCKET_HTTP}/${diffDir}/${name}-${commitRange[1]}.png`
      const line = `**${name}** [(before)](${beforeURL}) [(after)](${afterURL})`
      if (imageCount > MAX_INLINE_IMAGES) {
        commentLines.push(line + ` [(diff)](${diffURL})`)
      } else {
        commentLines.push(line)
        commentLines.push(`![${name} comparison](${diffURL})`)
        imageCount++
      }
    })
    commentBody = commentLines.join('\n')
  }

  ghIssue.createComment({body: commentBody}, (err, res) => {
    if (err) {
      console.log('Failed to post visual diff on GitHub:', err)
      process.exit(1)
    }
    console.log('Posted visual diff on GitHub:', res.html_url)
  })
})
