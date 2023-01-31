#!groovy

import groovy.json.JsonSlurperClassic

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

def withKbweb(closure) {
  try {
    withEnv(["COMPOSE_HTTP_TIMEOUT=120"]) {
      withCredentials([
        string(credentialsId: 's3-secrets-access-key-id', variable: 'S3_SECRETS_ACCESS_KEY_ID'),
        string(credentialsId: 's3-secrets-secret-access-key', variable: 'S3_SECRETS_SECRET_ACCESS_KEY'),
      ]) {
        // Coyne: I logged this next line to confirm it was coming through
        // println "Using S3 Secrets AccessKeyID with length = ${env.S3_SECRETS_ACCESS_KEY_ID.length()}"
        retry(5) {
          sh "docker-compose down"
          sh "docker-compose up -d mysql.local"
        }
        // Give MySQL a few seconds to start up.
        sleep(10)
        sh "docker-compose up -d kbweb.local"
      }
    }

    closure()
  } catch (ex) {
    def kbwebName = helpers.containerName('docker-compose', 'kbweb')
    println "kbweb is running in ${kbwebName}"

    println "Dockers:"
    sh "docker ps -a"
    sh "docker-compose stop"
    helpers.logContainer('docker-compose', 'mysql')
    logKbwebServices(kbwebName)
    throw ex
  } finally {
    sh "docker-compose down"
  }
}

def logKbwebServices(container) {
  sh "docker cp ${container}:/keybase/logs ./kbweb-logs"
  sh "tar -C kbweb-logs -czvf kbweb-logs.tar.gz ."
  archive("kbweb-logs.tar.gz")
}

helpers.rootLinuxNode(env, {
  helpers.slackOnError("client", env, currentBuild)
}, {}) {
  properties([
    [$class: "BuildDiscarderProperty",
      strategy: [$class: "LogRotator",
        numToKeepStr: "30",
        daysToKeepStr: "10",
        artifactNumToKeepStr: "10",
      ]
    ],
    [$class: 'RebuildSettings',
      autoRebuild: true,
    ],
    parameters([
        string(
            name: 'kbwebProjectName',
            defaultValue: '',
            description: 'The project name of the upstream kbweb build',
        ),
    ]),
  ])

  def kbwebProjectName = env.kbwebProjectName
  def cause = helpers.getCauseString(currentBuild)
  println "Cause: ${cause}"
  println "Pull Request ID: ${env.CHANGE_ID}"

  env.BASEDIR=pwd()
  env.GOPATH="${env.BASEDIR}/go"
  def kbwebTag = cause == 'upstream' && kbwebProjectName != '' ? kbwebProjectName : 'master'
  def images = [
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/glibc"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/mysql"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/sqsd"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/kbweb:${kbwebTag}"),
  ]
  def kbfsfuseImage

  def kbwebNodePrivateIP = httpRequest("http://169.254.169.254/latest/meta-data/local-ipv4").content

  println "Running on host $kbwebNodePrivateIP"
  println "Setting up build: ${env.BUILD_TAG}"

  ws("client") {

    stage("Setup") {
      parallel (
        checkout: {
          retry(3) {
            checkout scm
            sh 'echo -n $(git --no-pager show -s --format="%an" HEAD) > .author_name'
            sh 'echo -n $(git --no-pager show -s --format="%ae" HEAD) > .author_email'
            env.AUTHOR_NAME = readFile('.author_name')
            env.AUTHOR_EMAIL = readFile('.author_email')
            sh 'rm .author_name .author_email'
            sh 'echo -n $(git rev-parse HEAD) > go/revision'
            sh "git add go/revision"
            env.GIT_COMMITTER_NAME = 'Jenkins'
            env.GIT_COMMITTER_EMAIL = 'ci@keybase.io'
            sh 'git commit --author="Jenkins <ci@keybase.io>" -am "revision file added"'
            env.COMMIT_HASH = readFile('go/revision')
          }
        },
        pull_images: {
          docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
            for (i in images) {
              i.pull()
              i.tag('latest')
            }
          }
        },
        remove_dockers: {
          sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
          sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
        },
      )
    }

    def goChanges = helpers.getChangesForSubdir('go', env)
    def hasGoChanges = goChanges.size() != 0
    def hasJSChanges = helpers.hasChanges('shared', env)
    def hasJenkinsfileChanges = helpers.getChanges(env.COMMIT_HASH, env.CHANGE_TARGET).findIndexOf{ name -> name =~ /Jenkinsfile/ } >= 0
    def hasKBFSChanges = false
    println "Has go changes: " + hasGoChanges
    println "Has JS changes: " + hasJSChanges
    println "Has Jenkinsfile changes: " + hasJenkinsfileChanges
    def dependencyFiles = [:]

    if (hasGoChanges && env.CHANGE_TARGET && !hasJenkinsfileChanges) {
      dir("go") {
        sh "make gen-deps"
        dependencyFiles = [
          linux: sh(returnStdout: true, script: "cat .go_package_deps_linux"),
          windows: sh(returnStdout: true, script: "cat .go_package_deps_windows"),
        ]
      }
    }

    stage("Test") {
      withKbweb() {
        parallel (
          failFast: true,
          test_linux: {
            def packagesToTest = [:]
            if (hasGoChanges || hasJenkinsfileChanges) {
              // Check protocol diffs
              // Clean the index first
              sh "git add -A"
              // Generate protocols
              dir ('protocol') {
                sh "yarn --frozen-lockfile"
                sh "make clean"
                sh "make"
              }
              checkDiffs(['./go/', './protocol/'], 'Please run \\"make\\" inside the client/protocol directory.')
              packagesToTest = getPackagesToTest(dependencyFiles, hasJenkinsfileChanges)
              hasKBFSChanges = packagesToTest.keySet().findIndexOf { key -> key =~ /^github.com\/keybase\/client\/go\/kbfs/ } >= 0
            } else {
              // Ensure that the change target branch has been fetched,
              // since Jenkins only does a sparse checkout by default.
              fetchChangeTarget()
            }
            parallel (
              failFast: true,
              test_xcompilation: { withEnv([
                "PATH=${env.PATH}:${env.GOPATH}/bin",
              ]) {
                if (env.BRANCH_NAME == "master" && cause != "upstream") {
                  // We only cross compile when we're on a master build and we
                  // weren't triggered by upstream. i.e. potentially breaking
                  // changes.
                  dir("go") {
                    def platforms = ["freebsd", "netbsd", "openbsd"]
                    for (platform in platforms) {
                        withEnv(["GOOS=${platform}"]) {
                            println "Testing compilation on ${platform}"
                              sh "go build -tags production -o keybase_${platform} github.com/keybase/client/go/keybase"
                            println "End testing compilation on ${platform}"
                        }
                    }
                  }
                }
              }},
              test_linux_go: { withEnv([
                "PATH=${env.PATH}:${env.GOPATH}/bin",
                "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                "GPG=/usr/bin/gpg.distrib",
              ]) {
                if (hasGoChanges || hasJenkinsfileChanges) {
                  testGo("test_linux_go_", packagesToTest, hasKBFSChanges)
                }
              }},
              test_linux_js: { withEnv([
                "PATH=${env.HOME}/.node/bin:${env.PATH}",
                "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                "NODE_OPTIONS=--max-old-space-size=4096",
              ]) {
                dir("shared") {
                  stage("JS Tests") {
                    sh "git config --global user.name 'Keybase Jenkins'"
                    sh "git config --global user.email 'jenkins@keyba.se'"
                    sh "./jenkins_test.sh js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                  }
                }
              }},
              integrate: {
                // Build the client docker first so we can immediately kick off KBFS
                if ((hasGoChanges && hasKBFSChanges) || hasJenkinsfileChanges) {
                  println "We have KBFS changes, so we are building kbfs-server."
                  dir('go') {
                    sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/keybase"
                    sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                    docker.build("kbclient")
                    dir('kbfs') {
                      sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsfuse"
                      sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                      sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase"
                      sh "cp ${env.GOPATH}/bin/git-remote-keybase ./kbfsgit/git-remote-keybase/git-remote-keybase"
                      withCredentials([string(credentialsId: 'kbfs-docker-cert-b64-new', variable: 'KBFS_DOCKER_CERT_B64')]) {
                        def kbfsCert = sh(returnStdout: true, script: "echo \"$KBFS_DOCKER_CERT_B64\" | sed 's/ //g' | base64 -d")
                        kbfsfuseImage = docker.build('897413463132.dkr.ecr.us-east-1.amazonaws.com/client', "--build-arg KEYBASE_TEST_ROOT_CERT_PEM=\"$kbfsCert\" .")
                      }
                      docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
                        kbfsfuseImage.push(env.BUILD_TAG)
                      }
                      // TODO(ZCLIENT-2469)
                      // if (env.BRANCH_NAME == "master" && cause != "upstream") {
                      //   build([
                      //     job: "/kbfs-server/master",
                      //     parameters: [
                      //       string(
                      //         name: 'kbfsProjectName',
                      //         value: env.BUILD_TAG,
                      //       ),
                      //       string(
                      //         name: 'kbwebProjectName',
                      //         value: kbwebTag,
                      //       ),
                      //     ]
                      //   ])
                      // }
                    }
                  }
                }
              },
            )
          },
          test_windows: {
            if (hasGoChanges || hasJenkinsfileChanges) {
              helpers.nodeWithCleanup('windows-ssh', {}, {}) {
                def BASEDIR="${pwd()}"
                def GOPATH="${BASEDIR}\\go"
                withEnv([
                  'GOROOT=C:\\Program Files\\go',
                  "GOPATH=\"${GOPATH}\"",
                  "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";\"${GOPATH}\\bin\";${env.PATH}",
                  "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                  "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                  "TMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                  "TEMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                ]) {
                ws("client") {
                  println "Checkout Windows"
                  retry(3) {
                    checkout scm
                  }

                  println "Test Windows"
                  parallel (
                    test_windows_go: {
                      testGo("test_windows_go_", getPackagesToTest(dependencyFiles, hasJenkinsfileChanges), hasKBFSChanges)
                    }
                  )
                }}
              }
            }
          },
        )
      }
    }

    stage("Push") {
      if (env.BRANCH_NAME == "master" && cause != "upstream") {
        docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
          kbfsfuseImage.push('master')
        }
      } else {
        println "Not pushing docker"
      }
    }
  }
}

def getTestDirsNix() {
  def dirs = sh(
    returnStdout: true,
    script: "go list ./... | grep -v 'bind'"
  ).trim()
  println "Running tests for dirs: " + dirs
  return dirs.tokenize()
}

def getTestDirsWindows() {
  def dirs = bat(returnStdout: true, script: "@go list ./... | find /V \"/go/bind\"").trim()
  println "Running tests for dirs: " + dirs
  return dirs.tokenize()
}

def fetchChangeTarget() {
  if (env.CHANGE_TARGET) {
    // Load list of packages that changed.
    sh "git config --add remote.origin.fetch +refs/heads/*:refs/remotes/origin/* # timeout=10"
    sh "git fetch origin ${env.CHANGE_TARGET}"
  }
}

def getBaseCommitHash() {
    return sh(returnStdout: true, script: "git rev-parse origin/${env.CHANGE_TARGET}").trim()
}

def getDiffFileList() {
    def BASE_COMMIT_HASH = getBaseCommitHash()
    return sh(returnStdout: true, script: "bash -c \"set -o pipefail; git merge-tree \$(git merge-base ${BASE_COMMIT_HASH} HEAD) ${BASE_COMMIT_HASH} HEAD | grep '[0-9]\\+\\s[0-9a-f]\\{40\\}' | awk '{print \\\$4}'\"").trim()
}

def getDiffGoDependencies() {
    def BASE_COMMIT_HASH = getBaseCommitHash()
    return sh(returnStdout: true,
    script: """
      # only output the new and modified dependencies using version to compare
      diff --unchanged-line-format= --old-line-format= --new-line-format='%L' <(
          base_dir="\$(mktemp -d)" &&
          # get the go.mod & go.sum from the base commit OR fail if they don't exist
          git show ${BASE_COMMIT_HASH}:go/go.mod > "\$base_dir/go.mod" &&
          git show ${BASE_COMMIT_HASH}:go/go.sum > "\$base_dir/go.sum" &&
          cd "\$base_dir" &&
          # ignoring the current module github.com/keybase/client/go (where .Main=true) and list all dependencies and their versions
          # if the dependency is forked (or replaced), print out forked version instead
          go list -f '{{if not .Main}}{{ .Path }} {{if .Replace}}{{ .Replace.Version }}{{else}}{{ .Version }}{{end}}{{end}}' -m all | sort
        ) <(
          cd go &&
          # ignoring the current module github.com/keybase/client/go (where .Main=true) and list all dependencies and their versions
          # if the dependency is forked (or replaced), print out forked version instead
          go list -f '{{if not .Main}}{{ .Path }} {{if .Replace}}{{ .Replace.Version }}{{else}}{{ .Version }}{{end}}{{end}}' -m all | sort
        ) | cut -d' ' -f1 # trim the version number leaving just the module
    """).trim().split()
}

def getPackagesToTest(dependencyFiles, hasJenkinsfileChanges) {
  def packagesToTest = [:]
  dir('go') {
    // The below has produce a garden variety of errors. Maybe we can re-enable
    // it. At some point.
    // if (env.CHANGE_TARGET && !hasJenkinsfileChanges) {
    //  // The Jenkinsfile hasn't changed, so we try to run a minimal set of
    //  // tests to capture the changes in this PR.
    //  fetchChangeTarget()
    //  def diffFileList = getDiffFileList()
    //  def diffPackageList = sh(returnStdout: true, script: "bash -c \"set -o pipefail; echo '${diffFileList}' | grep '^go\\/' | sed 's/^\\(.*\\)\\/[^\\/]*\$/github.com\\/keybase\\/client\\/\\1/' | sort | uniq\"").trim().split()
    //  def diffPackagesAsString = diffPackageList.join(' ')
    //  println "Go packages changed:\n${diffPackagesAsString}"
    //  def diffDependencies = getDiffGoDependencies()
    //  def diffDependenciesAsString = diffDependencies.join(' ')
    //  println "Go dependencies changed:\n${diffDependenciesAsString}"

    //  // Load list of dependencies and mark all dependent packages to test.
    //  def goos = sh(returnStdout: true, script: "go env GOOS").trim()
    //  def dependencyMap = new JsonSlurperClassic().parseText(dependencyFiles[goos])
    //  diffPackageList.each { pkg ->
    //    // pkg changed; we need to load it from dependencyMap to see
    //    // which tests should be run.
    //    dependencyMap[pkg].each { dep, _ ->
    //      packagesToTest[dep] = 1
    //    }
    //  }
    //  diffDependencies.each { pkg ->
    //    // dependency changed; we need to load it from dependencyMap to see
    //    // which tests should be run.
    //    dependencyMap[pkg].each { dep, _ ->
    //      packagesToTest[dep] = 1
    //    }
    //  }
    //  return packagesToTest
    //}
    //println "This is a branch build or the Jenkinsfile has changed, so we are running all tests."
    diffPackageList = sh(returnStdout: true, script: 'go list ./...').trim().split()
    // If we get here, just run all the tests in `diffPackageList`
    diffPackageList.each { pkg ->
      if (pkg != 'github.com/keybase/client/go/bind') {
        packagesToTest[pkg] = 1
      }
    }
  }
  return packagesToTest
}

def testGo(prefix, packagesToTest, hasKBFSChanges) {
  dir('go') {
  withEnv([
    "KEYBASE_LOG_SETUPTEST_FUNCS=1",
    "KEYBASE_RUN_CI=1",
  ].plus(isUnix() ? [] : [
    'CC=C:\\cygwin64\\bin\\x86_64-w64-mingw32-gcc.exe',
    'CPATH=C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include;C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include\\ddk',
  ])) {
  parallel (
    test_go_builds: {
      testGoBuilds(prefix, packagesToTest, hasKBFSChanges)
    },
    test_go_test_suite: {
      testGoTestSuite(prefix, packagesToTest)
    },
    failFast: true
  )
  }}
}

def testGoBuilds(prefix, packagesToTest, hasKBFSChanges) {
  if (prefix == "test_linux_go_") {
    dir("keybase") {
      sh "go build -o keybase_production -ldflags \"-s -w\" -buildmode=pie --tags=production"
    }
    dir("fuzz") {
      sh "go build -tags gofuzz ./..."
    }
  } else if (prefix == "test_windows_go_") {
    dir("keybase") {
      sh "go build -o keybase_production -ldflags \"-s -w\" --tags=production"
    }
  }

  println "Running golint"
  dir("buildtools") {
    retry(5) {
      sh 'go install golang.org/x/lint/golint'
    }
  }
  retry(5) {
    timeout(activity: true, time: 1200, unit: 'SECONDS') {
      sh 'make -s lint'
    }
  }

  if (prefix == "test_linux_go_") {
    // Only test golangci-lint on linux
    println "Installing golangci-lint"
    dir("buildtools") {
      retry(5) {
        sh 'go install github.com/golangci/golangci-lint/cmd/golangci-lint'
      }
    }

    // TODO re-enable for kbfs.
    // if (hasKBFSChanges) {
    //   println "Running golangci-lint on KBFS"
    //   dir('kbfs') {
    //     retry(5) {
    //       timeout(activity: true, time: 720, unit: 'SECONDS') {
    //         // Ignore the `dokan` directory since it contains lots of c code.
    //         sh 'go list -f "{{.Dir}}" ./...  | fgrep -v dokan  | xargs realpath --relative-to=. | xargs golangci-lint run --deadline 10m0s'
    //       }
    //     }
    //   }
    // }

    if (env.CHANGE_TARGET) {
      println("Running golangci-lint on new code")
      fetchChangeTarget()
      def BASE_COMMIT_HASH = getBaseCommitHash()
      timeout(activity: true, time: 720, unit: 'SECONDS') {
        // Ignore the `protocol` directory, autogeneration has some critques
        sh "go list -f '{{.Dir}}' ./...  | fgrep -v kbfs | fgrep -v protocol | xargs realpath --relative-to=. | xargs golangci-lint run --new-from-rev ${BASE_COMMIT_HASH} --deadline 10m0s"
      }
    } else {
      println("Running golangci-lint on all non-KBFS code")
      timeout(activity: true, time: 720, unit: 'SECONDS') {
        sh "make golangci-lint-nonkbfs"
      }
    }

    // Windows `gofmt` pukes on CRLF.
    // Macos pukes on mockgen because ¯\_(ツ)_/¯.
    // So, only run on Linux.
    println "Running mockgen"
    dir("buildtools") {
      retry(5) {
        sh 'go install github.com/golang/mock/mockgen'
      }
    }
    dir('kbfs/data') {
      retry(5) {
        timeout(activity: true, time: 90, unit: 'SECONDS') {
          sh '''
            set -e -x
            ./gen_mocks.sh
            git diff --exit-code
          '''
        }
      }
    }
    dir('kbfs/libkbfs') {
      retry(5) {
        timeout(activity: true, time: 90, unit: 'SECONDS') {
          sh '''
            set -e -x
            ./gen_mocks.sh
            git diff --exit-code
          '''
        }
      }
    }
  }
}

def testGoTestSuite(prefix, packagesToTest) {
  def dirs = getTestDirsNix()
  def goversion = sh(returnStdout: true, script: "go version").trim()
  println "Testing Go code on commit ${env.COMMIT_HASH} with ${goversion}. Merging to branch ${env.CHANGE_TARGET}."

  // Make sure we don't accidentally pull in the testing package.
  sh '! go list -f \'{{ join .Deps "\\n" }}\' github.com/keybase/client/go/keybase | grep testing'

  println "Building citogo"
  sh '(cd citogo && go install)'

  def packageTestSet = packagesToTest.keySet()
  println "Go packages to test:\n${packageTestSet.join('\n')}"

  def tests = [:]
  def testSpecMap = [
    test_linux_go_: [
      '*': [],
      'github.com/keybase/client/go/chat': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/chat/attachments': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/test': [
        name: 'kbfs_test_fuse',
        flags: '-tags fuse',
        timeout: '15m',
      ],
      'github.com/keybase/client/go/kbfs/data': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libfuse': [
        // TODO re-enable
        // flags: '',
        // timeout: '5m',
        // citogo_extra : '--pause 1s',
        // no_citogo : '1'
        disable: true,
      ],
      'github.com/keybase/client/go/kbfs/idutil': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsblock': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfscodec': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfscrypto': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsedits': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsgit': [
        flags: '-race',
        timeout: '10m',
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase': [
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/fsrpc': [
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/kbfshash': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsmd': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfssync': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbpagesconfig': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/ldbutils': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libcontext': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libfs': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libgit': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libhttpserver': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libkey': [
        flags: '-race',
        timeout: '5m',
      ],
      'github.com/keybase/client/go/kbfs/libkbfs': [
        flags: '-race',
        timeout: '5m',
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/libpages': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libpages/config': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/search': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/simplefs': [
        flags: '-race',
        timeout: '2m',
      ],
      'github.com/keybase/client/go/kbfs/test': [
        name: 'kbfs_test_race',
        flags: '-race',
        timeout: '12m',
      ],
      'github.com/keybase/client/go/kbfs/tlf': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/tlfhandle': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/dokan': [
        disable: true,
      ],
      'github.com/keybase/client/go/teams': [
        parallel: 1,
      ],
    ],
    test_windows_go_: [
      '*': [],
      'github.com/keybase/client/go/systests': [
        disable: true,
      ],
      'github.com/keybase/client/go/chat': [
        disable: true,
      ],
      'github.com/keybase/client/go/teams': [
        disable: true,
      ],
      'github.com/keybase/client/go/kbfs/libdokan': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/dokan': [
        compileAlone: true,
      ],
    ],
  ]
  def getOverallTimeout = { testSpec ->
    def timeoutMatches = (testSpec.timeout =~ /(\d+)([ms])/)
    return [
      time: 1 + (timeoutMatches[0][1] as Integer),
      unit: timeoutMatches[0][2] == 's' ? 'SECONDS' : 'MINUTES',
    ]
  }
  def defaultPackageTestSpec = { pkg ->
    def dirPath = pkg.replaceAll('github.com/keybase/client/go/', '')
    def testName = dirPath.replaceAll('/', '_')
    return [
      name: testName,
      flags: '',
      timeout: '30m',
      dirPath: dirPath,
      parallel: 4,
      pkg: pkg,
    ]
  }
  def getPackageTestSpec = { pkg ->
    if (testSpecMap[prefix].containsKey(pkg)) {
      if (testSpecMap[prefix][pkg]) {
        def testSpec = testSpecMap[prefix][pkg]
        if (testSpec['disable']) {
          return false
        }
        return defaultPackageTestSpec(pkg) + testSpec
      }
      return defaultPackageTestSpec(pkg)
    }
    if (testSpecMap[prefix].containsKey('*')) {
      return defaultPackageTestSpec(pkg)
    }
    return false
  }

  println "Compiling ${packageTestSet.size()} test(s)"
  def packageTestCompileList = []
  def packageTestRunList = []
  packagesToTest.each { pkg, _ ->
    def testSpec = getPackageTestSpec(pkg)
    if (testSpec && !testSpec.disable) {
      testSpec.testBinary = "${testSpec.name}.test"
      packageTestCompileList.add([
        closure: {
          sh "go test -vet=off -c ${testSpec.flags} -o ${testSpec.dirPath}/${testSpec.testBinary} ./${testSpec.dirPath}"
        },
        alone: !!testSpec.compileAlone,
      ])
      packageTestRunList.add([
        closure: { spec ->
          dir(spec.dirPath) {
            // Only run the test if a test binary should have been produced.
            if (fileExists(spec.testBinary)) {
              println "Running tests for ${spec.dirPath}"
              def t = getOverallTimeout(spec)
              timeout(activity: true, time: t.time, unit: t.unit) {
                if (spec.no_citogo) {
                  sh "./${spec.testBinary} -test.timeout ${spec.timeout}"
                } else {
                  sh "citogo --flakes 3 --fails 3 --build-id ${env.BUILD_ID} --branch ${env.BRANCH_NAME} --prefix ${spec.dirPath} --s3bucket ci-fail-logs --report-lambda-function report-citogo --build-url ${env.BUILD_URL} --no-compile --test-binary ./${spec.testBinary} --timeout 150s -parallel=${spec.parallel} ${spec.citogo_extra ? spec.citogo_extra : ''}"
                }
              }
            }
          }
        }.curry(testSpec),
        alone: !!testSpec.runAlone,
      ])
    }
  }
  executeInWorkers(3, true /* runFirstItemAlone */, packageTestCompileList)

  helpers.waitForURLWithTimeout(prefix, env.KEYBASE_SERVER_URI, 600)
  println "Running ${packageTestSet.size()} test(s)"
  withCredentials([
    string(credentialsId: 'citogo-flake-webhook', variable : 'CITOGO_FLAKE_WEBHOOK'),
    string(credentialsId: 'citogo-aws-secret-access-key', variable : 'CITOGO_AWS_SECRET_ACCESS_KEY'),
    string(credentialsId: 'citogo-aws-access-key-id', variable : 'CITOGO_AWS_ACCESS_KEY_ID'),
    string(credentialsId: 'citogo-master-fail-webhook', variable : 'CITOGO_MASTER_FAIL_WEBHOOK'),
  ]) {
    executeInWorkers(4, false /* runFirstItemAlone */, packageTestRunList)
  }
}

def executeInWorkers(numWorkers, runFirstItemAlone, queue) {
  def workers = [:]
  def i = 0
  for (n = 1; n <= numWorkers; n++) {
    workers["worker_${n}"] = {
      def done = false
      for (; !done;) {
        def item
        def alone

        // Concurrency hack
        def lockID = "${env.BUILD_TAG}"
        lock(lockID) {
          if (i < queue.size()) {
            item = queue.getAt(i)
            // Run first item on its own if requested
            alone = item.alone || (runFirstItemAlone && i == 0)
            if (alone) {
              item.closure()
            }
            i++
          } else {
            done = true
          }
        }
        if (done) {
          break
        }
        if (!alone) {
          item.closure()
        }
      }
    }
  }
  workers.failFast = true
  parallel(workers)
}

def checkDiffs(dirs, addressMessage) {
  def joinedDirs = dirs.join(" ")
  try {
    sh "git diff --patience --exit-code HEAD -- ${joinedDirs}"
  } catch (ex) {
    sh """
        bash -c 'echo "ERROR: \\"git diff\\" detected changes. Some files in the directories {${dirs.join(", ")}} are stale. ${addressMessage}" && (exit 1)'
    """
  }
}
