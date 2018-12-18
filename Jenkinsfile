#!groovy

import groovy.json.JsonSlurperClassic

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

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
            //[$class: "ParametersDefinitionProperty",
            //    parameterDefinitions: [
            //        [$class: 'StringParameterDefinition',
            //            name: 'gregorProjectName',
            //            defaultValue: '',
            //            description: 'name of upstream gregor project',
            //        ]
            //    ]
            //],
            //[$class: "ParametersDefinitionProperty",
            //    parameterDefinitions: [
            //        [$class: 'StringParameterDefinition',
            //            name: 'kbwebProjectName',
            //            defaultValue: '',
            //            description: 'name of upstream kbweb project',
            //        ]
            //    ]
            //],
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
                            sh "git fetch origin ${env.CHANGE_TARGET}"
                            env.BASE_COMMIT_HASH = sh(returnStdout: true, script: "git rev-parse origin/${env.CHANGE_TARGET}")
                        }
                    },
                    pull_glibc: {
                        glibcImage.pull()
                    },
                    pull_mysql: {
                        mysqlImage.pull()
                    },
                    pull_gregor: {
                        gregorImage.pull()
                    },
                    pull_kbweb: {
                        kbwebImage.pull()
                    },
                    remove_dockers: {
                        sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
                        sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
                    },
                )
            }
        }

        def goChanges = helpers.getChangesForSubdir('go', env)
        def hasGoChanges = goChanges.size() != 0
        def hasJSChanges = helpers.hasChanges('shared', env)
        println "Has go changes: " + hasGoChanges
        println "Has JS changes: " + hasJSChanges

        stage("Test") {
            helpers.withKbweb() {
                parallel (
                    test_linux_deps: {
                        if (hasGoChanges) {
                            // Build the client docker first so we can immediately kick off KBFS
                            // FIXME: temporarily avoid this while we merge the Jenkinsfiles.
                            // dir('go') { parallel (
                            //     build_image: {
                            //         sh "go install github.com/keybase/client/go/keybase"
                            //         sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                            //         clientImage = docker.build("keybaseprivate/kbclient")
                            //         sh "docker save keybaseprivate/kbclient | gzip > kbclient.tar.gz"
                            //         archive("kbclient.tar.gz")
                            //         sh "rm kbclient.tar.gz"
                            //     },
                            // )}

                            // Check protocol diffs
                            // Clean the index first
                            sh "git add -A"
                            // Generate protocols
                            dir ('protocol') {
                                sh "npm i"
                                sh "make clean"
                                sh "make"
                            }
                            checkDiffs(['./go/', './protocol/'])
                        }
                        parallel (
                            test_linux: {
                                parallel (
                                    check_deps: {
                                        // Checking deps can happen in parallel
                                        // since we won't be rebuilding anything in Go.
                                        if (hasGoChanges) {
                                            dir('go') {
                                                sh "make gen-deps"
                                                checkDiffs(['./'])
                                            }
                                        }
                                    },
                                    test_linux_go: { withEnv([
                                        "PATH=${env.PATH}:${env.GOPATH}/bin",
                                        "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                    ]) {
                                        if (hasGoChanges) {
                                            dir("go/keybase") {
                                                sh "go build --tags=production"
                                            }
                                            testGo("test_linux_go_")
                                        }
                                    }},
                                    // FIXME: re-enable
                                    //test_linux_js: { withEnv([
                                    //    "PATH=${env.HOME}/.node/bin:${env.PATH}",
                                    //    "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                                    //    "NODE_OPTIONS=--max-old-space-size=4096",
                                    //]) {
                                    //    dir("shared") {
                                    //        stage("JS Tests") {
                                    //            sh "./jenkins_test.sh js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                                    //        }
                                    //    }
                                    //}},
                                )
                            },
                        )
                    },
                    test_windows: {
                        // TODO: If we re-enable tests other than Go tests on
                        // Windows, this check should go away.
                        if (hasGoChanges) {
                            helpers.nodeWithCleanup('windows-ssh-backup', {}, {}) {
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
                                                bat "go build --tags=production"
                                            }
                                            dir("go/keybase") {
                                                bat "go build"
                                            }
                                            testGo("test_windows_go_")
                                        }
                                    )
                                }}
                            }
                        }
                    },
                    test_macos: {
                        // TODO: Currently we only run macos tests on master builds.
                        if (env.BRANCH_NAME == "master") {
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
                                        //    println "Test React Native"
                                        //    dir("react-native") {
                                        //        sh "npm i"
                                        //        lock("iossimulator_${env.NODE_NAME}") {
                                        //            sh "npm run test-ios"
                                        //        }
                                        //    }
                                        //},
                                        test_macos_go: {
                                            if (hasGoChanges) {
                                                dir("go/keybase") {
                                                    sh "go build --tags=production"
                                                }
                                                testGo("test_macos_go_")
                                            }
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
                docker.withRegistry("https://docker.io", "docker-hub-creds") {
                    clientImage.push()
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

def testGo(prefix) {
    dir('go') {
    withEnv([
        "KEYBASE_LOG_SETUPTEST_FUNCS=1",
        "KEYBASE_RUN_CI=1",
    ]) {
        def dirs = getTestDirsNix()
        def goversion = sh(returnStdout: true, script: "go version").trim()
        println "Testing Go code on commit ${env.COMMIT_HASH} with ${goversion}. Merging to branch ${env.CHANGE_TARGET}."

        println "Running golint"
        retry(5) {
            sh 'go get -u golang.org/x/lint/golint'
        }
        retry(5) {
            timeout(activity: true, time: 30, unit: 'SECONDS') {
                sh 'make -s lint'
            }
        }
        if (isUnix()) {
            // Windows `gofmt` pukes on CRLF, so only run on *nix.
            println "Check that files are formatted correctly"
            sh 'test -z $(gofmt -l $(go list ./... | sed -e s/github.com.keybase.client.go.// ))'
        }
        // Make sure we don't accidentally pull in the testing package.
        sh '! go list -f \'{{ join .Deps "\\n" }}\' github.com/keybase/client/go/keybase | grep testing'

        println "Running go vet"
        // FIXME: once Dokan warnings are fixed, remove it from the filter here.
        sh 'go list ./... | grep -v "github.com/keybase/client/go/bind\\|github.com/keybase/client/go/kbfs/dokan" | xargs go vet'

        // Load list of packages that changed.
        def diffPackageList = sh(returnStdout: true, script: "git --no-pager diff --name-only ${env.BASE_COMMIT_HASH} -- . | sed \'s/^\\(.*\\)\\/[^\\/]*\$/github.com\\/keybase\\/client\\/\\1/\' | sort | uniq").trim().split()
        println "Go packages changed:\n${diffPackageList}"

        // Load list of dependencies and mark all dependent packages to test.
        def packagesToTest = [:]
        def goos = sh(returnStdout: true, script: "go env GOOS").trim()
        def dependencyFile = sh(returnStdout: true, script: "cat .go_package_deps_${goos}")
        def dependencyMap = new JsonSlurperClassic().parseText(dependencyFile)
        diffPackageList.each { pkg ->
            // pkg changed; we need to load it from dependencyMap to see
            // which tests should be run.
            dependencyMap[pkg].each { dep, _ ->
                packagesToTest[dep] = 1
            }
        }
        println "Go packages to test:\n${packagesToTest.keySet().join('\n')}"

        def tests = [:]
        def specialTests = [:]
        def specialTestFilter = ['chat', 'engine', 'teams', 'chat_storage', 'systests']
        packagesToTest.each { pkg, _ ->
            def dirPath = pkg.replaceAll('github.com/keybase/client/go/', '')
            println "Building tests for $dirPath"
            dir(dirPath) {
                sh "go test -i"
                sh "go test -c -o test.test"
                // Only run the test if a test binary should have been produced.
                if (fileExists("test.test")) {
                    def testName = dirPath.replaceAll('/', '_')
                    def test = {
                        dir(dirPath) {
                            println "Running tests for $dirPath"
                            sh "./test.test -test.timeout 30m"
                        }
                    }
                    if (testName in specialTestFilter) {
                        specialTests[prefix + testName] = test
                    } else {
                        tests[prefix + testName] = test
                    }
                    println "Will run tests for $dirPath"
                } else {
                    println "Skipping tests for $dirPath because no test binary was produced."
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

def checkDiffs(dirs) {
    def joinedDirs = dirs.join(" ")
    try {
        sh "git diff --patience --exit-code HEAD -- ${joinedDirs}"
    } catch (ex) {
        println "ERROR: `git diff` detected changes. Some files in the directories {${dirs.join(", ")}} are stale"
        throw ex
    }
}
