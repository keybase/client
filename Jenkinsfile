#!groovy

import groovy.json.JsonSlurperClassic

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

def withKbweb(closure) {
  try {
    retry(5) {
      sh "docker-compose up -d mysql.local"
    }
    // Give MySQL a few seconds to start up.
    sleep(10)
    sh "docker-compose up -d kbweb.local"

    closure()
  } catch (ex) {
    def kbwebName = helpers.containerName('docker-compose', 'kbweb')
    println "kbweb is running in ${kbwebName}"

    println "Dockers:"
    sh "docker ps -a"
    sh "docker-compose stop"
    helpers.logContainer('docker-compose', 'mysql')
    helpers.logContainer('docker-compose', 'gregor')
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
        string(
            name: 'gregorProjectName',
            defaultValue: '',
            description: 'The project name of the upstream gregor build',
        ),
    ]),
  ])

  env.BASEDIR=pwd()
  env.GOPATH="${env.BASEDIR}/go"
  def mysqlImage = docker.image("keybaseprivate/mysql")
  def gregorImage = docker.image("keybaseprivate/kbgregor")
  def kbwebImage = docker.image("keybaseprivate/kbweb")
  def glibcImage = docker.image("keybaseprivate/glibc")
  def clientImage = null

  def kbwebNodePrivateIP = httpRequest("http://169.254.169.254/latest/meta-data/local-ipv4").content

  println "Running on host $kbwebNodePrivateIP"
  println "Setting up build: ${env.BUILD_TAG}"

  def cause = helpers.getCauseString(currentBuild)
  println "Cause: ${cause}"
  println "Pull Request ID: ${env.CHANGE_ID}"

  ws("${env.GOPATH}/src/github.com/keybase/client") {

    stage("Setup") {
      sh "docker rmi keybaseprivate/mysql || echo 'No mysql image to remove'"
      docker.withRegistry("", "docker-hub-creds") {
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
          pull_glibc: {
            glibcImage.pull()
          },
          pull_mysql: {
            mysqlImage.pull()
          },
          pull_gregor: {
            if (cause == "upstream" && kbwebProjectName != '') {
                retry(3) {
                    step([$class: 'CopyArtifact',
                            projectName: "${kbwebProjectName}",
                            filter: 'kbgregor.tar.gz',
                            fingerprintArtifacts: true,
                            selector: [$class: 'TriggeredBuildSelector',
                                allowUpstreamDependencies: false,
                                fallbackToLastSuccessful: false,
                                upstreamFilterStrategy: 'UseGlobalSetting'],
                            target: '.'])
                    sh "gunzip -c kbgregor.tar.gz | docker load"
                }
            } else {
                gregorImage.pull()
            }
          },
          pull_kbweb: {
            if (cause == "upstream" && kbwebProjectName != '') {
                retry(3) {
                    step([$class: 'CopyArtifact',
                            projectName: "${kbwebProjectName}",
                            filter: 'kbweb.tar.gz',
                            fingerprintArtifacts: true,
                            selector: [$class: 'TriggeredBuildSelector',
                                allowUpstreamDependencies: false,
                                fallbackToLastSuccessful: false,
                                upstreamFilterStrategy: 'UseGlobalSetting'],
                            target: '.'])
                    sh "gunzip -c kbweb.tar.gz | docker load"
                }
            } else {
                kbwebImage.pull()
            }
          },
          remove_dockers: {
            sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
            sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
          },
        )
      }
    }

    def hasJenkinsfileChanges = helpers.getChanges(env.COMMIT_HASH, env.CHANGE_TARGET).findIndexOf{ name -> name =~ /Jenkinsfile/ } >= 0
    def goChanges = helpers.getChangesForSubdir('go', env)
    def hasGoChanges = goChanges.size() != 0 || hasJenkinsfileChanges
    def hasJSChanges = helpers.hasChanges('shared', env)
    println "Has go changes: " + hasGoChanges
    println "Has JS changes: " + hasJSChanges
    def dependencyFiles = [:]

    if (hasGoChanges && env.CHANGE_TARGET) {
      dir("go") {
        sh "make gen-deps"
        dependencyFiles = [
          linux: sh(returnStdout: true, script: "cat .go_package_deps_linux"),
          darwin: sh(returnStdout: true, script: "cat .go_package_deps_darwin"),
          windows: sh(returnStdout: true, script: "cat .go_package_deps_windows"),
        ]
      }
    }

    stage("Test") {
      withKbweb() {
        parallel (
          test_linux_deps: {
            if (hasGoChanges) {
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
            }
            parallel (
              test_linux: {
                def packagesToTest = [:]
                if (hasGoChanges) {
                  packagesToTest = getPackagesToTest(dependencyFiles)
                } else {
                  // Ensure that the change target branch has been fetched,
                  // since Jenkins only does a sparse checkout by default.
                  fetchChangeTarget()
                }
                parallel (
                  test_xcompilation: { withEnv([
                    "PATH=${env.PATH}:${env.GOPATH}/bin",
                  ]) {
                    if (hasGoChanges) {
                      def platforms = ["freebsd", "netbsd", "openbsd"]
                      for (platform in platforms) {
                          withEnv(["GOOS=${platform}"]) {
                              println "Testing compilation on ${platform}"
                              sh "go build -tags production github.com/keybase/client/go/keybase"
                              println "End testing compilation on ${platform}"
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
                    if (hasGoChanges) {
                      dir("go/keybase") {
                        sh "go build -ldflags \"-s -w\" -buildmode=pie --tags=production"
                      }
                      dir("go/fuzz") {
                        sh "go build -tags gofuzz ./..."
                      }
                      testGo("test_linux_go_", packagesToTest)
                    }
                  }},
                  test_linux_js: { withEnv([
                    "PATH=${env.HOME}/.node/bin:${env.PATH}",
                    "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                    "NODE_OPTIONS=--max-old-space-size=4096",
                  ]) {
                    dir("shared") {
                      stage("JS Tests") {
                        sh "./jenkins_test.sh js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                      }
                    }
                  }},
                  integrate: {
                    // Build the client docker first so we can immediately kick off KBFS
                    def hasKBFSChanges = packagesToTest.keySet().findIndexOf { key -> key =~ /^github.com\/keybase\/client\/go\/kbfs/ } >= 0
                    if (hasGoChanges && hasKBFSChanges) {
                      println "We have KBFS changes, so we are building kbfs-server."
                      dir('go') {
                        sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/keybase"
                        sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                        clientImage = docker.build("keybaseprivate/kbclient")
                        // TODO: only do this when we need to run at least one KBFS test.
                        dir('kbfs') {
                          sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsfuse"
                          sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                          sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase"
                          sh "cp ${env.GOPATH}/bin/git-remote-keybase ./kbfsgit/git-remote-keybase/git-remote-keybase"
                          withCredentials([[$class: 'StringBinding', credentialsId: 'kbfs-docker-cert-b64-new', variable: 'KBFS_DOCKER_CERT_B64']]) {
                            println "Building Docker"
                            sh '''
                              set +x
                              KBFS_DOCKER_CERT="$(echo $KBFS_DOCKER_CERT_B64 | sed 's/ //g' | base64 -d)"
                              docker build -t keybaseprivate/kbfsfuse \
                                  --build-arg KEYBASE_TEST_ROOT_CERT_PEM="$KBFS_DOCKER_CERT" \
                                  --build-arg KEYBASE_TEST_ROOT_CERT_PEM_B64="$KBFS_DOCKER_CERT_B64" .
                            '''
                          }
                          sh "docker save keybaseprivate/kbfsfuse | gzip > kbfsfuse.tar.gz"
                          archive("kbfsfuse.tar.gz")
                          build([
                              job: "/kbfs-server/master",
                              parameters: [
                                string(
                                  name: 'kbfsProjectName',
                                  value: env.JOB_NAME,
                                ),
                              ]
                          ])
                        }
                      }
                    }
                  },
                )
              },
            )
          },
          test_windows: {
            // TODO: If we re-enable tests other than Go tests on
            // Windows, this check should go away.
            if (hasGoChanges) {
              helpers.nodeWithCleanup('windows-ssh', {}, {}) {
                def BASEDIR="${pwd()}"
                def GOPATH="${BASEDIR}\\go"
                withEnv([
                  'GOROOT=C:\\go',
                  "GOPATH=\"${GOPATH}\"",
                  "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";\"${GOPATH}\\bin\";${env.PATH}",
                  "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                  "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                  "TMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                  "TEMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                ]) {
                ws("$GOPATH/src/github.com/keybase/client") {
                  println "Checkout Windows"
                  retry(3) {
                    checkout scm
                  }

                  println "Test Windows"
                  parallel (
                    test_windows_go: {
                      // TODO: if we re-enable tests
                      // other than Go tests on Windows,
                      // add a `hasGoChanges` check here.
                      dir("go/keybase") {
                        bat "go build -ldflags \"-s -w\" --tags=production"
                      }
                      testGo("test_windows_go_", getPackagesToTest(dependencyFiles))
                    }
                  )
                }}
              }
            }
          },
          test_macos: {
            def mountDir='/Volumes/untitled/client'
            helpers.nodeWithCleanup('macstadium', {}, {
                sh "rm -rf ${mountDir} || echo 'Something went wrong with cleanup.'"
              }) {
              def BASEDIR="${pwd()}/${env.BUILD_NUMBER}"
              def GOPATH="${BASEDIR}/go"
              dir(mountDir) {
                // Ensure that the mountDir exists
                sh "touch test.txt"
              }
              withEnv([
                "GOPATH=${GOPATH}",
                "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                "PATH=${env.PATH}:${GOPATH}/bin:${env.HOME}/.node/bin",
                "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                "TMPDIR=${mountDir}",
              ]) {
              ws("$GOPATH/src/github.com/keybase/client") {
                println "Checkout OS X"
                retry(3) {
                  checkout scm
                }

                parallel (
                  //test_react_native: {
                  //  println "Test React Native"
                  //  dir("react-native") {
                  //    sh "npm i"
                  //    lock("iossimulator_${env.NODE_NAME}") {
                  //      sh "npm run test-ios"
                  //    }
                  //  }
                  //},
                  test_macos_go: {
                    if (hasGoChanges) {
                      dir("go/keybase") {
                        sh "go build -ldflags \"-s -w\" --tags=production"
                      }
                      testGo("test_macos_go_", getPackagesToTest(dependencyFiles))
                    }
                  }
                )
              }}
            }
          },
        )
      }
    }

    stage("Push") {
      if (env.BRANCH_NAME == "master" && cause != "upstream") {
        docker.withRegistry("https://docker.io", "docker-hub-creds") {
          clientImage.push()
          sh "docker push keybaseprivate/kbfsfuse"
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
    script: "go list ./... | grep -v 'vendor\\|bind'"
  ).trim()
  println "Running tests for dirs: " + dirs
  return dirs.tokenize()
}

def getTestDirsWindows() {
  def dirs = bat(returnStdout: true, script: "@go list ./... | find /V \"vendor\" | find /V \"/go/bind\"").trim()
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

def getPackagesToTest(dependencyFiles) {
  def packagesToTest = [:]
  dir('go') {
    if (env.CHANGE_TARGET) {
      fetchChangeTarget()
      def diffFileList = getDiffFileList()
      if (!diffFileList.contains('Jenkinsfile')) {
        // The Jenkinsfile hasn't changed, so we try to run a minimal set of
        // tests to capture the changes in this PR.
        def diffPackageList = sh(returnStdout: true, script: "bash -c \"set -o pipefail; echo '${diffFileList}' | grep '^go\\/' | sed 's/^\\(.*\\)\\/[^\\/]*\$/github.com\\/keybase\\/client\\/\\1/' | sort | uniq\"").trim().split()
        def diffPackagesAsString = diffPackageList.join(' ')
        println "Go packages changed:\n${diffPackagesAsString}"

        // Load list of dependencies and mark all dependent packages to test.
        def goos = sh(returnStdout: true, script: "go env GOOS").trim()
        def dependencyMap = new JsonSlurperClassic().parseText(dependencyFiles[goos])
        diffPackageList.each { pkg ->
          // pkg changed; we need to load it from dependencyMap to see
          // which tests should be run.
          dependencyMap[pkg].each { dep, _ ->
            packagesToTest[dep] = 1
          }
        }
        return packagesToTest
      }
    }
    println "This is a branch build or the Jenkinsfile has changed, so we are running all tests."
    diffPackageList = sh(returnStdout: true, script: 'go list ./... | grep -v vendor').trim().split()
    // If we get here, just run all the tests in `diffPackageList`
    diffPackageList.each { pkg ->
      if (pkg != 'github.com/keybase/client/go/bind') {
        packagesToTest[pkg] = 1
      }
    }
  }
  return packagesToTest
}

def testGo(prefix, packagesToTest) {
  dir('go') {
  withEnv([
    "KEYBASE_LOG_SETUPTEST_FUNCS=1",
    "KEYBASE_RUN_CI=1",
  ].plus(isUnix() ? [] : [
    'CC=C:\\cygwin64\\bin\\x86_64-w64-mingw32-gcc.exe',
    'CPATH=C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include;C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include\\ddk',
  ])) {
    def dirs = getTestDirsNix()
    def goversion = sh(returnStdout: true, script: "go version").trim()
    println "Testing Go code on commit ${env.COMMIT_HASH} with ${goversion}. Merging to branch ${env.CHANGE_TARGET}."

    println "Running golint"
    retry(5) {
      sh 'go get -u golang.org/x/lint/golint'
    }
    retry(5) {
      timeout(activity: true, time: 90, unit: 'SECONDS') {
        sh 'make -s lint'
      }
    }

    println "Installing golangci-lint"
    dir("..") {
      retry(5) {
        // This works with go1.12.12 but not go1.13.1 with an error containing "invalid pseudo-version"
        sh 'GO111MODULE=on go get github.com/golangci/golangci-lint/cmd/golangci-lint@v1.16.0'
      }
    }


    def hasKBFSChanges = packagesToTest.keySet().findIndexOf { key -> key =~ /^github.com\/keybase\/client\/go\/kbfs/ } >= 0
    if (hasKBFSChanges) {
      println "Running golangci-lint on KBFS"
      dir('kbfs') {
        retry(5) {
          timeout(activity: true, time: 180, unit: 'SECONDS') {
          // Ignore the `dokan` directory since it contains lots of c code.
          // Ignore the `protocol` directory, autogeneration has some critques
          sh 'go list -f "{{.Dir}}" ./...  | fgrep -v dokan | xargs realpath --relative-to=. | xargs golangci-lint run'
          }
        }
      }
    }

    if (env.CHANGE_TARGET) {
      println("Running golangci-lint on new code")
      fetchChangeTarget()
      def BASE_COMMIT_HASH = getBaseCommitHash()
      timeout(activity: true, time: 360, unit: 'SECONDS') {
        sh "go list -f '{{.Dir}}' ./...  | fgrep -v kbfs | fgrep -v protocol | xargs realpath --relative-to=. | xargs golangci-lint run --new-from-rev ${BASE_COMMIT_HASH} --deadline 5m0s"
      }

      println("Running golangci-lint for dead code")
      timeout(activity: true, time: 360, unit: 'SECONDS') {
        def diffFileList = getDiffFileList()
        def diffPackageList = sh(returnStdout: true, script: "bash -c \"set -o pipefail; echo '${diffFileList}' | { grep '^go\\/' || true; } | { grep -v 'go/revision' || true; } | { grep -v 'go/vendor' || true; } | { grep -v 'go/Makefile' || true; } | sed 's/^go\\///' | sed 's/^\\(.*\\)\\/[^\\/]*\$/\\1/' | sort | uniq\"").trim().split()
        diffPackageList.each { pkg ->
          dir(pkg) {
            // Ignore the exit code 5, which indicates that there were
            // no files to analyze -- that's expected if the files were
            // all tagged for a different platform.
            sh 'golangci-lint run --no-config --disable-all --enable=deadcode --deadline 5m0s || test $? -eq 5'
          }
        }
      }
    }

    if (prefix == "test_linux_go_") {
      // Windows `gofmt` pukes on CRLF.
      // Macos pukes on mockgen because ¯\_(ツ)_/¯.
      // So, only run on Linux.
      println "Running mockgen"
      retry(5) {
        sh 'go get -u github.com/golang/mock/mockgen'
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

    // Make sure we don't accidentally pull in the testing package.
    sh '! go list -f \'{{ join .Deps "\\n" }}\' github.com/keybase/client/go/keybase | grep testing'

    def packageTestList = packagesToTest.keySet()
    println "Go packages to test:\n${packageTestList.join('\n')}"

    def tests = [:]
    def specialTests = [:]
    def specialTestFilter = ['chat', 'engine', 'teams', 'chat_storage', 'systests', 'kbfs_libdokan']
    def testSpecMap = [
      test_macos_go_: [
        'github.com/keybase/client/go/kbfs/test': [
          name: 'kbfs_test_fuse',
          flags: '-tags fuse',
          timeout: '15m',
        ],
        'github.com/keybase/client/go/kbfs/libfuse': [
          timeout: '3m',
        ],
        'github.com/keybase/client/go/libkb': [
          timeout: '5m',
        ],
        'github.com/keybase/client/go/install': [
          timeout: '30s',
        ],
        'github.com/keybase/client/go/launchd': [
          timeout: '30s',
        ],
      ],
      test_linux_go_: [
        '*': [],
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
          flags: '',
          timeout: '3m',
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
      ],
      test_windows_go_: [
        '*': [],
        'github.com/keybase/client/go/systests': [
          disable: true,
        ],
        'github.com/keybase/client/go/chat': [
          disable: true,
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
    packagesToTest.each { pkg, _ ->
      def testSpec = getPackageTestSpec(pkg)
      if (!testSpec) {
        return
      }

      println "Running go vet for ${pkg}"
      sh "go vet ${pkg} || (ERR=\$? && echo \"go vet failed with error code \$ERR\" && exit \$ERR)"

      if (isUnix()) {
        // Windows `gofmt` pukes on CRLF, so only run on *nix.
        println "Check that files are formatted correctly"
        sh "test -z \$(gofmt -l \$(sed 's/github.com.keybase.client.go.//' ${pkg} ))"
      }

      println "Building tests for ${testSpec.dirPath}"
      dir(testSpec.dirPath) {
        def testBinary = "${testSpec.name}.test"
        sh "go test -i"
        sh "go test -c ${testSpec.flags} -o ${testBinary}"
        // Only run the test if a test binary should have been produced.
        if (fileExists(testBinary)) {
          def test = {
            dir(testSpec.dirPath) {
              def t = getOverallTimeout(testSpec)
              timeout(activity: true, time: t.time, unit: t.unit) {
                println "Running tests for ${testSpec.dirPath}"
                sh "./${testBinary} -test.timeout ${testSpec.timeout}"
              }
            }
          }
          if (testSpec.name in specialTestFilter) {
            specialTests["${prefix}${testSpec.name}"] = test
          } else {
            tests["${prefix}${testSpec.name}"] = test
          }
          println "Will run tests for ${testSpec.dirPath}"
        } else {
          println "Skipping tests for ${testSpec.dirPath} because no test binary was produced."
        }
      }
    }

    // Schedule the tests
    def parallelTests = []
    def testBatch = [:]
    tests.each { name, closure ->
      if (testBatch.size() == 4) {
        parallelTests << testBatch
        testBatch = [:]
      }
      testBatch[name] = closure
    }
    if (testBatch.size() > 0) {
      parallelTests << testBatch
    }
    parallelTests << specialTests
    helpers.waitForURL(prefix, env.KEYBASE_SERVER_URI)
    parallelTests.each { batch ->
      parallel(batch)
    }
  }}
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
