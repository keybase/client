#!/usr/bin/env node
// @flow

import os from 'os'
import process from 'process'
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {spawnSync} from 'child_process'
import _ from 'lodash'
import mkdirp from 'mkdirp'
import del from 'del'
import gm from 'gm'
import github from 'octonode'
import s3 from 's3'

const BUCKET_S3 = process.env['VISDIFF_S3_BUCKET']
const BUCKET_HTTP = `https://${BUCKET_S3}.s3.amazonaws.com`
const MAX_INLINE_IMAGES = 6

const DIFF_NEW = 'new'
const DIFF_REMOVED = 'removed'
const DIFF_CHANGED = 'changed'
const DIFF_SAME = 'same'
const DIFF_ERROR = 'error'

const DRY_RUN = !!process.env['VISDIFF_DRY_RUN']
const WORK_DIR = process.env['VISDIFF_WORK_DIR'] || path.join(os.tmpdir(), 'visdiff')

function spawn (...args) {
  var res = spawnSync(...args)
  if (res.error) {
    throw res.error
  } else if (res.status !== 0) {
    throw new Error('Unexpected exit code: ' + res.status)
  }
  return res
}

function packageHash () {
  return crypto.createHash('sha1').update(fs.readFileSync('package.json')).digest('hex').substr(0, 12)
}

function checkout (commit) {
  const origPackageHash = packageHash()

  del.sync([`node_modules.${origPackageHash}`])
  if (fs.existsSync('node_modules')) {
    fs.renameSync('node_modules', `node_modules.${origPackageHash}`)
    console.log(`Shelved node_modules to node_modules.${origPackageHash}.`)
  }

  spawn('git', ['checkout', '-f', commit])

  // The way shared is linked in Windows can confuse git into deleting files
  // and leaving the directory in an unclean state.
  spawn('git', ['reset', '--hard'])

  console.log(`Checked out ${commit}.`)

  const newPackageHash = packageHash()
  if (fs.existsSync(`node_modules.${newPackageHash}`)) {
    console.log(`Reusing existing node_modules.${newPackageHash} directory.`)
    fs.renameSync(`node_modules.${newPackageHash}`, 'node_modules')
  } else {
    console.log(`Installing dependencies for package.json:${newPackageHash}...`)
  }

  spawn('yarn', ['install'], {stdio: 'inherit'})
}

function renderScreenshots (commitRange) {
  const repoPath = spawn('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf-8'}).stdout.trim()
  const relPath = path.relative(repoPath, process.cwd())
  if (!fs.existsSync(WORK_DIR)) {
    console.log(`Creating clone in work dir: ${WORK_DIR}`)
    const result = spawn('git', ['clone', repoPath, path.join(WORK_DIR)])
    if (result.status !== 0) {
      console.log(`Error creating work dir clone:`, result.error, result.stderr)
      process.exit(1)
    }
  } else {
    console.log(`Note: using existing work dir: ${WORK_DIR}. Try clearing out this directory if you are having problems.`)
  }
  const workPath = path.join(WORK_DIR, relPath)
  console.log(`Running in work dir: ${workPath}`)
  process.chdir(workPath)
  for (const commit of commitRange) {
    checkout(commit)
    console.log(`Rendering screenshots of ${commit}`)
    mkdirp.sync(`screenshots/${commit}`)
    const startTime = Date.now()
    spawn('yarn', ['run', 'render-screenshots', '--', `screenshots/${commit}`], {stdio: 'inherit'})
    console.log(`Rendered in ${(Date.now() - startTime) / 1000}s.`)
  }
}

function compareScreenshots (commitRange, diffDir, callback) {
  console.log('Comparing screenshots...')
  const results = {}

  mkdirp.sync(`screenshots/${diffDir}`)

  const files0 = fs.readdirSync(`screenshots/${commitRange[0]}`)
  const files1 = fs.readdirSync(`screenshots/${commitRange[1]}`)
  const files = _.union(files0, files1)
  const totalFiles = files.length
  function compareNext () {
    const filename = files.pop()
    if (!filename) {
      callback(diffDir, commitRange, results)
      return
    }

    if (filename.startsWith('.')) {
      return
    }

    console.log(`[${totalFiles - files.length} / ${totalFiles}] comparing ${filename}`)

    const diffPath = `screenshots/${diffDir}/${filename}`

    if (filename.endsWith('-ERROR.png')) {
      results[diffPath] = DIFF_ERROR
      compareNext()
      return
    } else if (results[diffPath.replace(/\.png$/, '-ERROR.png')] === DIFF_ERROR) {
      // skip comparing against mocks that errored
      compareNext()
      return
    }

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
      file: diffPath,
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

function processDiff (diffDir, commitRange, results) {
  const errorResults = []
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
        const toFileName = `${filenameParts.name}-${commit}${filenameParts.ext}`
        if (fs.existsSync(fromFile)) {
          fs.renameSync(fromFile, `${filenameParts.dir}/${toFileName}`)
          if (result === DIFF_ERROR) {
            errorResults.push({commit, name: filenameParts.name, filename: toFileName})
          }
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

  errorResults.forEach(({commit, name, filename}) => {
    const errorURL = `${BUCKET_HTTP}/${diffDir}/${filename}`
    const line = ` * Error in ${commit}: **${name}**`
    if (imageCount > MAX_INLINE_IMAGES) {
      commentLines.push(line + ` [(view)](${errorURL})`)
    } else {
      commentLines.push(line + '  ')
      commentLines.push(`   ![${name} rendered](${errorURL})`)
      imageCount++
    }
  })

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
    const countParts = []
    if (errorResults.length) {
      countParts.push(`${errorResults.length} errored`)
    }
    if (newResults.length) {
      countParts.push(`${newResults.length} new`)
    }
    if (removedResults.length) {
      countParts.push(`${removedResults.length} removed`)
    }
    if (changedResults.length) {
      countParts.push(`${changedResults.length} changed`)
    }

    if (errorResults.length) {
      commentLines.unshift(`:no_entry: Error rendering the commits ${commitRange[0]}...${commitRange[1]} on ${os.platform()}. <details><summary>:mag_right: ${countParts.join(', ')}</summary>\n`)
    } else {
      commentLines.unshift(`The commits ${commitRange[0]}...${commitRange[1]} introduce visual changes on ${os.platform()}. <details><summary>:mag_right: ${countParts.join(', ')}</summary>\n`)
    }
    commentLines.push(`</summary>`)
    const commentBody = commentLines.join('\n')

    if (!DRY_RUN) {
      console.log(`Uploading ${diffDir} to s3://${BUCKET_S3}...`)

      const s3client = s3.createClient({
        s3Options: {
          accessKeyId: process.env['VISDIFF_AWS_ACCESS_KEY_ID'],
          secretAccessKey: process.env['VISDIFF_AWS_SECRET_ACCESS_KEY'],
        },
      })
      const uploader = s3client.uploadDir({
        localDir: `screenshots/${diffDir}`,
        s3Params: {
          Bucket: BUCKET_S3,
          Prefix: diffDir,
          ACL: 'public-read',
        },
      })

      uploader.on('error', err => {
        console.error('Upload failed', err)
        process.exit(1)
      })

      uploader.on('end', () => {
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
      })
    } else {
      console.log(commentBody)
    }
  } else {
    console.log('No visual changes found as a result of these commits.')
  }
  console.log(`Results in: ${path.resolve('screenshots', diffDir)}`)
}

function resolveCommit (name) {
  let result
  if (name.startsWith('merge-base(')) {
    let params
    try {
      params = name.match(/\((.*)\)/)[1].split(/\s*,\s*/)
      assert.equal(params.length, 2, 'There should be two parameters')
    } catch (e) {
      console.log('Failed to parse commit:', e)
      process.exit(1)
    }
    result = spawn('git', ['merge-base', params[0], params[1]], {encoding: 'utf-8'})
  } else {
    result = spawn('git', ['rev-parse', name], {encoding: 'utf-8'})
  }
  if (result.status !== 0 || !result.stdout) {
    console.log(`Error resolving commit "${name}":`, result.error, result.stderr)
    process.exit(1)
  }
  let resolved = result.stdout.trim().substr(0, 12)  // remove whitespace and clip for shorter paths
  console.log(`Resolved "${name}" -> ${resolved}`)
  return resolved
}

if (process.argv.length !== 3) {
  console.log(`Usage: node ${path.basename(process.argv[1])} COMMIT1..COMMIT2`)
  process.exit(1)
}

const commitRange = process.argv[2]
  .split(/\.{2,3}/)  // Travis gives us ranges like START...END
  .map(resolveCommit)

console.log(`Performing visual diff of ${commitRange[0]}...${commitRange[1]}:`)
const diffDir = `${Date.now()}-${commitRange[0]}-${commitRange[1]}-${os.platform()}`
renderScreenshots(commitRange)
compareScreenshots(commitRange, diffDir, processDiff)
