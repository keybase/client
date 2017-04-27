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

    sh "curl -s http://169.254.169.254/latest/meta-data/public-ipv4 > public.txt"
    sh "curl -s http://169.254.169.254/latest/meta-data/local-ipv4 > private.txt"
    def kbwebNodePublicIP = readFile('public.txt')
    def kbwebNodePrivateIP = readFile('private.txt')
    sh "rm public.txt"
    sh "rm private.txt"
    def httpRequestPublicIP = httpRequest("http://169.254.169.254/latest/meta-data/public-ipv4").content
    def httpRequestPrivateIP = httpRequest("http://169.254.169.254/latest/meta-data/local-ipv4").content

    println "Running on host $kbwebNodePublicIP ($kbwebNodePrivateIP)"
    println "httpRequest says host $httpRequestPublicIP ($httpRequestPrivateIP)"
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

        stage("Test") {
            helpers.withKbweb() {
                // Build the client docker first so we can immediately kick off KBFS
                dir('go') {
                    sh "go install github.com/keybase/client/go/keybase"
                    sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                    clientImage = docker.build("keybaseprivate/kbclient")
                    sh "docker save keybaseprivate/kbclient | gzip > kbclient.tar.gz"
                    archive("kbclient.tar.gz")
                    sh "rm kbclient.tar.gz"
                }
                parallel (
                    //test_linux: {
                    //    dir("protocol") {
                    //        sh "./diff_test.sh"
                    //    }
                    //    parallel (
                    //        test_linux_go: { withEnv([
                    //            "PATH=${env.PATH}:${env.GOPATH}/bin",
                    //            "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                    //            "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                    //        ]) {
                    //            testNixGo("Linux")
                    //        }},
                    //        test_linux_js: { withEnv([
                    //            "PATH=${env.HOME}/.node/bin:${env.PATH}",
                    //            "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                    //        ]) {
                    //            dir("shared") {
                    //                stage("JS tests") {
                    //                    sh "./jenkins_test.sh js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                    //                }
                    //            }
                    //            // Only run visdiff for PRs
                    //            if (env.CHANGE_ID) {
                    //                wrap([$class: 'Xvfb', screen: '1280x1024x16']) {
                    //                withCredentials([[$class: 'UsernamePasswordMultiBinding',
                    //                        credentialsId: 'visdiff-aws-creds',
                    //                        usernameVariable: 'VISDIFF_AWS_ACCESS_KEY_ID',
                    //                        passwordVariable: 'VISDIFF_AWS_SECRET_ACCESS_KEY',
                    //                    ],[$class: 'StringBinding',
                    //                        credentialsId: 'visdiff-github-token',
                    //                        variable: 'VISDIFF_GH_TOKEN',
                    //                ]]) {
                    //                withEnv([
                    //                    "VISDIFF_S3_BUCKET=keybase-jenkins-visdiff",
                    //                    "VISDIFF_WORK_DIR=${env.BASEDIR}/visdiff",
                    //                    "VISDIFF_PR_ID=${env.CHANGE_ID}",
                    //                ]) {
                    //                    dir("shared") {
                    //                        sh "./jenkins_test.sh visdiff-install ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                    //                    }
                    //                    try {
                    //                        timeout(time: 10, unit: 'MINUTES') {
                    //                            dir("shared") {
                    //                                stage("js visdiff") {
                    //                                    sh "./jenkins_test.sh visdiff ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                    //                                }
                    //                            }
                    //                        }
                    //                    } catch (e) {
                    //                        helpers.slackMessage("#breaking-visdiff", "warning", "<@mgood>: visdiff failed: <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_DISPLAY_NAME}>")
                    //                    }
                    //                }}}
                    //            }
                    //        }},
                    //    )
                    //},
                    //test_windows: {
                    //    helpers.nodeWithCleanup('windows', {}, {}) {
                    //        def BASEDIR="${pwd()}\\${env.BUILD_NUMBER}"
                    //        def GOPATH="${BASEDIR}\\go"
                    //        withEnv([
                    //            'GOROOT=C:\\tools\\go',
                    //            "GOPATH=\"${GOPATH}\"",
                    //            "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";${env.PATH}",
                    //            "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                    //            "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                    //        ]) {
                    //        ws("$GOPATH/src/github.com/keybase/client") {
                    //            println "Checkout Windows"
                    //            retry(3) {
                    //                checkout scm
                    //            }

                    //            println "Test Windows"
                    //            parallel (
                    //                test_windows_go: {
                    //                    println "Test Windows Go"
                    //                    dir("go") {
                    //                        dir ("keybase") {
                    //                            bat "go build -a 2>&1 || exit /B 1"
                    //                            bat "echo %errorlevel%"
                    //                        }
                    //                        bat "go list ./... | find /V \"vendor\" | find /V \"/go/bind\" > testlist.txt"
                    //                        bat "go get \"github.com/stretchr/testify/require\""
                    //                        bat "go get \"github.com/stretchr/testify/assert\""
                    //                        helpers.waitForURL("Windows", env.KEYBASE_SERVER_URI)
                    //                        def testlist = readFile('testlist.txt')
                    //                        def tests = testlist.tokenize()
                    //                        for (test in tests) {
                    //                            bat "go test -timeout 10m ${test}"
                    //                        }
                    //                    }
                    //                },
                    //                test_windows_js: {
                    //                // Only run visdiff for PRs
                    //                // FIXME (MBG): Disabled temporarily due to flaky false positives
                    //                if (false && env.CHANGE_ID) {
                    //                wrap([$class: 'Xvfb']) {
                    //                    println "Test Windows JS"
                    //                    dir("visdiff") {
                    //                        bat "yarn install --pure-lockfile"
                    //                    }
                    //                    dir("desktop") {
                    //                        bat "yarn install --pure-lockfile"
                    //                        withCredentials([[$class: 'UsernamePasswordMultiBinding',
                    //                                credentialsId: 'visdiff-aws-creds',
                    //                                usernameVariable: 'VISDIFF_AWS_ACCESS_KEY_ID',
                    //                                passwordVariable: 'VISDIFF_AWS_SECRET_ACCESS_KEY',
                    //                            ],[$class: 'StringBinding',
                    //                                credentialsId: 'visdiff-github-token',
                    //                                variable: 'VISDIFF_GH_TOKEN',
                    //                        ]]) {
                    //                        withEnv([
                    //                            "VISDIFF_PR_ID=${env.CHANGE_ID}",
                    //                        ]) {
                    //                            bat '..\\node_modules\\.bin\\keybase-visdiff "merge-base(origin/master, HEAD)...HEAD"'
                    //                        }}
                    //                    }
                    //                }}},
                    //            )
                    //        }}
                    //    }
                    //},
                    test_osx: {
                        helpers.nodeWithCleanup('macstadium', {}, {}) {
                            def BASEDIR="${pwd()}/${env.BUILD_NUMBER}"
                            def GOPATH="${BASEDIR}/go"
                            withEnv([
                                "GOPATH=${GOPATH}",
                                "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                                "PATH=${env.PATH}:${GOPATH}/bin:${env.HOME}/.node/bin",
                                "KEYBASE_SERVER_URI=http://${kbwebNodePublicIP}:3000",
                                "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
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
                                    test_osx: {
                                        println "Test OS X"
                                        testNixGo("OS X")
                                    }
                                )
                            }}
                        }
                    },
                    //test_kbfs: {
                    //    build([
                    //        job: "/kbfs/master",
                    //        parameters: [
                    //            [$class: 'StringParameterValue',
                    //                name: 'clientProjectName',
                    //                value: env.JOB_NAME,
                    //            ],
                    //            [$class: 'StringParameterValue',
                    //                name: 'kbwebNodePrivateIP',
                    //                value: kbwebNodePrivateIP,
                    //            ],
                    //            [$class: 'StringParameterValue',
                    //                name: 'kbwebNodePublicIP',
                    //                value: kbwebNodePublicIP,
                    //            ],
                    //        ]
                    //    ])
                    //},
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

def testNixGo(prefix) {
    dir('go') {
        helpers.waitForURL(prefix, env.KEYBASE_SERVER_URI)
        sh "./test/jenkins_test.sh ${env.COMMIT_HASH} null"
    }
}
