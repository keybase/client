#!groovy

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
            [$class: "ParametersDefinitionProperty",
               parameterDefinitions: [
                   [$class: 'StringParameterDefinition',
                       name: 'gregorProjectName',
                       defaultValue: '',
                       description: 'name of upstream gregor project',
                   ]
               ]
            ],
            [$class: "ParametersDefinitionProperty",
               parameterDefinitions: [
                   [$class: 'StringParameterDefinition',
                       name: 'kbwebProjectName',
                       defaultValue: '',
                       description: 'name of upstream kbweb project',
                   ]
               ]
            ],
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

        def hasGoChanges = hasChanges('go')
        def hasJSChanges = hasChanges('shared')
        println "Has go changes: " + hasGoChanges
        println "Has JS changes: " + hasJSChanges

        stage("Test") {
            helpers.withKbweb() {
                parallel (
                    test_linux_deps: {
                        if (hasGoChanges) {
                            // Build the client docker first so we can immediately kick off KBFS
                            dir('go') {
                                sh "go install github.com/keybase/client/go/keybase"
                                sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                                clientImage = docker.build("keybaseprivate/kbclient")
                                sh "docker save keybaseprivate/kbclient | gzip > kbclient.tar.gz"
                                archive("kbclient.tar.gz")
                                sh "rm kbclient.tar.gz"
                            }
                        }
                        parallel (
                            test_linux: {
                                dir("protocol") {
                                    // sh "./diff_test.sh"
                                }
                                parallel (
                                    test_linux_go: { withEnv([
                                        "PATH=${env.PATH}:${env.GOPATH}/bin",
                                        "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                    ]) {
                                        if (hasGoChanges) {
                                            // testGo("test_linux_go_")
                                        }
                                    }},
                                    test_linux_js: { withEnv([
                                        "PATH=${env.HOME}/.node/bin:${env.PATH}",
                                        "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                                    ]) {
                                        dir("shared") {
                                            stage("JS Tests") {
                                                sh "node ./jenkins-test.js js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                                            }
                                        }
                                        // Only run visdiff for PRs
                                        if (env.CHANGE_ID) {
                                            wrap([$class: 'Xvfb', screen: '1280x1024x16']) {
                                            withCredentials([[$class: 'UsernamePasswordMultiBinding',
                                                    credentialsId: 'visdiff-aws-creds',
                                                    usernameVariable: 'VISDIFF_AWS_ACCESS_KEY_ID',
                                                    passwordVariable: 'VISDIFF_AWS_SECRET_ACCESS_KEY',
                                                ],[$class: 'StringBinding',
                                                    credentialsId: 'visdiff-github-token',
                                                    variable: 'VISDIFF_GH_TOKEN',
                                            ]]) {
                                            withEnv([
                                                "VISDIFF_S3_BUCKET=keybase-jenkins-visdiff",
                                                "VISDIFF_WORK_DIR=${env.BASEDIR}/visdiff",
                                                "VISDIFF_PR_ID=${env.CHANGE_ID}",
                                            ]) {
                                                dir("shared") {
                                                    sh "node ./jenkins-test.js visdiff-install ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                                                }
                                                try {
                                                    timeout(time: 10, unit: 'MINUTES') {
                                                        dir("shared") {
                                                            stage("js visdiff") {
                                                                sh "node ./jenkins-test.js visdiff ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                                                            }
                                                        }
                                                    }
                                                } catch (e) {
                                                    helpers.slackMessage("#breaking-visdiff", "warning", "<@mgood>: visdiff failed: <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_DISPLAY_NAME}>")
                                                }
                                            }}}
                                        }
                                    }},
                                )
                            },
                            test_kbfs: {
                                if (hasGoChanges) {
                                    build([
                                        job: "/kbfs/master",
                                        parameters: [
                                            string(
                                                name: 'clientProjectName',
                                                value: env.JOB_NAME,
                                            ),
                                            string(
                                                name: 'kbwebNodePrivateIP',
                                                value: kbwebNodePrivateIP,
                                            ),
                                        ]
                                    ])
                                }
                            },
                        )
                    },
                    test_windows: {
                        // TODO: If we re-enable tests other than Go tests on
                        // Windows, this check should go away.
                        if (hasGoChanges) {
                            helpers.nodeWithCleanup('windows', {}, {}) {
                                def BASEDIR="${pwd()}\\${env.BUILD_NUMBER}"
                                def GOPATH="${BASEDIR}\\go"
                                withEnv([
                                    'GOROOT=C:\\tools\\go',
                                    "GOPATH=\"${GOPATH}\"",
                                    "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";${env.PATH}",
                                    "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                    "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                ]) {
                                ws("$GOPATH/src/github.com/keybase/client") {
                                    println "Checkout Windows"
                                    retry(3) {
                                        checkout scm
                                    }

                                    println "Test Windows"
                                    parallel (
                                        test_windows_go: {
                                            if (hasGoChanges) {
                                                dir("go/keybase") {
                                                    bat "go build"
                                                }
                                                testGo("test_windows_go_")
                                            }
                                        },
                                        test_windows_js: {
                                        // Only run visdiff for PRs
                                        // FIXME (MBG): Disabled temporarily due to flaky false positives
                                        // When this is re-enabled, remove the if (hasGoChanges) check at the
                                        // beginning of this block.
                                        if (false && env.CHANGE_ID) {
                                        wrap([$class: 'Xvfb']) {
                                            println "Test Windows JS"
                                            dir("visdiff") {
                                                bat "yarn install --pure-lockfile"
                                            }
                                            dir("desktop") {
                                                bat "yarn install --pure-lockfile"
                                                withCredentials([[$class: 'UsernamePasswordMultiBinding',
                                                        credentialsId: 'visdiff-aws-creds',
                                                        usernameVariable: 'VISDIFF_AWS_ACCESS_KEY_ID',
                                                        passwordVariable: 'VISDIFF_AWS_SECRET_ACCESS_KEY',
                                                    ],[$class: 'StringBinding',
                                                        credentialsId: 'visdiff-github-token',
                                                        variable: 'VISDIFF_GH_TOKEN',
                                                ]]) {
                                                withEnv([
                                                    "VISDIFF_PR_ID=${env.CHANGE_ID}",
                                                ]) {
                                                    bat '..\\node_modules\\.bin\\keybase-visdiff "merge-base(origin/master, HEAD)...HEAD"'
                                                }}
                                            }
                                        }}},
                                    )
                                }}
                            }
                        }
                    },
                    test_macos: {
                        // TODO: If we re-enable tests other than Go tests on
                        // macOS, this check should go away.
                        if (hasGoChanges) {
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

def hasChanges(subdir) {
    dir(subdir) {
        def changes = helpers.getChanges(env.COMMIT_HASH, env.CHANGE_TARGET)
        println "Number of changes: " + changes.size()
        if (changes.size() == 0) {
            println "No ${subdir} changes, skipping tests."
            return false
        }
        return true
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
    ]) {
        def shell
        def dirs
        def slash
        def goversion
        if (isUnix()) {
            shell = { params -> sh params }
            dirs = getTestDirsNix()
            slash = '/'
            goversion = sh(returnStdout: true, script: "go version").trim()
        } else {
            shell = { params -> bat params }
            dirs = getTestDirsWindows()
            slash = '\\'
            goversion = bat(returnStdout: true, script: "@go version").trim()
        }
        println "Running tests on commit ${env.COMMIT_HASH} with ${goversion}."
        shell "go get \"github.com/stretchr/testify/require\""
        shell "go get \"github.com/stretchr/testify/assert\""
        def parallelTests = []
        def tests = [:]
        def specialTests = [:]
        def specialTestFilter = ['chat', 'engine', 'teams', 'chat_storage']
        for (def i=0; i<dirs.size(); i++) {
            if (tests.size() == 4) {
                parallelTests << tests
                tests = [:]
            }
            def d = dirs[i]
            def dirPath = d.replaceAll('github.com/keybase/client/go/', '')
            println "Building tests for $dirPath"
            dir(dirPath) {
                shell "go test -i"
                shell "go test -c -o test.test"
                // Only run the test if a test binary should have been produced.
                if (fileExists("test.test")) {
                    def testName = dirPath.replaceAll('/', '_')
                    def test = {
                        dir(dirPath) {
                            println "Running tests for $dirPath"
                            shell ".${slash}test.test -test.timeout 30m"
                        }
                    }
                    if (testName in specialTestFilter) {
                        specialTests[prefix + testName] = test
                    } else {
                        tests[prefix + testName] = test
                    }
                } else {
                    println "Skipping tests for $dirPath because no test binary was produced."
                }
            }
        }
        parallelTests << specialTests
        helpers.waitForURL(prefix, env.KEYBASE_SERVER_URI)
        for (def i=0; i<parallelTests.size(); i++) {
            parallel(parallelTests[i])
        }
    }}
}
