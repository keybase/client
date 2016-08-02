#!groovy

if (env.CHANGE_TITLE && env.CHANGE_TITLE.contains('[ci-skip]')) {
    println "Skipping build because PR title contains [ci-skip]"
} else {
    nodeWithCleanup("ec2-fleet", {
        slackOnError("client")
    }, {
        sh 'docker rm -v $(docker ps --filter status=exited -q 2>/dev/null) 2>/dev/null || echo "No Docker containers to remove"'
        sh 'docker rmi $(docker images --filter dangling=true -q --no-trunc 2>/dev/null) 2>/dev/null || echo "No Docker images to remove"'
    }) {
        properties([
                [$class: "BuildDiscarderProperty",
                    strategy: [$class: "LogRotator",
                        numToKeepStr: "30",
                        daysToKeepStr: "10",
                        artifactNumToKeepStr: "1",
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

        def cause = getCauseString()
        println "Cause: ${cause}"
        println "Pull Request ID: ${env.CHANGE_ID}"

        ws("${env.GOPATH}/src/github.com/keybase/client") {

            stage "Setup"
                sh "docker rmi keybaseprivate/mysql || echo 'No mysql image to remove'"
                docker.withRegistry("", "docker-hub-creds") {
                    parallel (
                        checkout: {
                            retry(3) {
                                checkout scm
                            }
                            sh 'echo -n $(git rev-parse HEAD) > go/revision'
                            sh "git add go/revision"
                            env.COMMIT_HASH = readFile('go/revision')
                            sh 'echo -n $(git --no-pager show -s --format="%an" HEAD) > .author_name'
                            sh 'echo -n $(git --no-pager show -s --format="%ae" HEAD) > .author_email'
                            env.AUTHOR_NAME = readFile('.author_name')
                            env.AUTHOR_EMAIL = readFile('.author_email')
                            sh 'rm .author_name .author_email'
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

                def kbweb = null

                try {
                    retry(5) {
                        sh "docker-compose up -d mysql.local"
                    }
                    sh "docker-compose up -d kbweb.local"

                    stage "Test"
                        parallel (
                            test_linux: {
                                parallel (
                                    test_linux_go: { withEnv([
                                        "PATH=${env.PATH}:${env.GOPATH}/bin",
                                        "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                    ]) {
                                        testNixGo("Linux")
                                    }},
                                    test_linux_js: { withEnv([
                                        "PATH=${env.HOME}/.node/bin:${env.PATH}",
                                        "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                                        "KEYBASE_JS_VENDOR_DIR=${env.BASEDIR}/js-vendor-desktop",
                                    ]) {
                                        dir("desktop") {
                                            sh "npm run vendor-install"
                                            sh "unzip ${env.KEYBASE_JS_VENDOR_DIR}/flow/flow-linux64*.zip -d ${env.BASEDIR}"
                                            sh "${env.BASEDIR}/flow/flow status shared"
                                        }
                                        sh "desktop/node_modules/.bin/eslint ."
                                        dir("protocol") {
                                            sh "./diff_test.sh"
                                        }
                                        // Only run visdiff for PRs
                                        if (env.CHANGE_ID) {
                                            wrap([$class: 'Xvfb']) { 
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
                                                dir("visdiff") {
                                                    sh "npm install"
                                                }
                                                sh "npm install ./visdiff"
                                                dir("desktop") {
                                                    sh "../node_modules/.bin/keybase-visdiff 'merge-base(origin/master, HEAD)...HEAD'"
                                                }
                                            }}}
                                        }
                                    }},
                                    test_kbfs: {
                                        dir('go') {
                                            sh "go install github.com/keybase/client/go/keybase"
                                            sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                                            clientImage = docker.build("keybaseprivate/kbclient")
                                            sh "docker save keybaseprivate/kbclient | gzip > kbclient.tar.gz"
                                            archive("kbclient.tar.gz")
                                            //build([
                                            //    job: "/kbfs/master",
                                            //    parameters: [
                                            //        [$class: 'StringParameterValue',
                                            //            name: 'clientProjectName',
                                            //            value: env.JOB_NAME,
                                            //        ],
                                            //        [$class: 'StringParameterValue',
                                            //            name: 'kbwebNodePrivateIP',
                                            //            value: kbwebNodePrivateIP,
                                            //        ],
                                            //        [$class: 'StringParameterValue',
                                            //            name: 'kbwebNodePublicIP',
                                            //            value: kbwebNodePublicIP,
                                            //        ],
                                            //    ]
                                            //])
                                        }
                                    },
                                )
                            },
                            test_windows: {
                                nodeWithCleanup('windows', {}, {}) {
                                    def BASEDIR=pwd()
                                    def GOPATH="${BASEDIR}/go"
                                    withEnv([
                                        'GOROOT=C:\\tools\\go',
                                        "GOPATH=\"${GOPATH}\"",
                                        "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";${env.PATH}",
                                        "KEYBASE_JS_VENDOR_DIR=${env.BASEDIR}\\js-vendor-desktop",
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
                                                println "Test Windows Go"
                                                bat "choco install -y golang --version 1.6"
                                                bat "choco install -y gpg4win-vanilla --version 2.3.1"
                                                dir("go") {
                                                    dir ("keybase") {
                                                        bat "go build -a 2>&1 || exit /B 1"
                                                        bat "echo %errorlevel%"
                                                    }
                                                    bat "go list ./... | find /V \"vendor\" | find /V \"/go/bind\" > testlist.txt"
                                                    bat "choco install -y curl"
                                                    waitForURL("Windows", env.KEYBASE_SERVER_URI)
                                                    bat "for /f %%i in (testlist.txt) do (go test -timeout 10m %%i || exit /B 1)"
                                                }
                                            },
                                            test_windows_js: {
                                            // Only run visdiff for PRs
                                            // FIXME (MBG): Disabled temporarily due to flaky false positives
                                            if (false && env.CHANGE_ID) {
                                            wrap([$class: 'Xvfb']) {
                                                println "Test Windows JS"
                                                bat "choco install -y nodejs.install --allow-downgrade --version 6.1.0"
                                                bat "choco install -y python --version 2.7.11"
                                                bat "choco install -y graphicsmagick --version 1.3.24"
                                                dir("visdiff") {
                                                    bat "npm install"
                                                }
                                                bat "npm install .\\visdiff"
                                                dir("desktop") {
                                                    bat "npm run vendor-install"
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
                            },
                            test_osx: {
                                nodeWithCleanup('osx', {}, {}) {
                                    def BASEDIR=pwd()
                                    def GOPATH="${BASEDIR}/go"
                                    withEnv([
                                        "GOPATH=${GOPATH}",
                                        "PATH=${env.PATH}:${GOPATH}/bin",
                                        "KEYBASE_SERVER_URI=http://${kbwebNodePublicIP}:3000",
                                        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                                    ]) {
                                    ws("$GOPATH/src/github.com/keybase/client") {
                                        println "Checkout OS X"
                                            retry(3) {
                                                checkout scm
                                            }

                                        println "Test OS X"
                                            testNixGo("OS X")
                                    }}
                                }
                            },
                        )
                } catch (ex) {
                    println "Gregor logs:"
                    sh "docker-compose logs gregor.local"
                    println "MySQL logs:"
                    sh "docker-compose logs mysql.local"
                    println "KBweb logs:"
                    sh "docker-compose logs kbweb.local"
                    throw ex
                } finally {
                    sh "docker-compose down"
                }


            stage "Push"

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

def waitForURL(prefix, url) {
    def waitFor = 300;
    if (isUnix()) {
        sh """ bash -c '
            slept=0
            while [[ "\$slept" -lt "${waitFor}" ]]; do
                curl -s -o /dev/null ${url} && echo "Connected to ${url} after waiting \$slept times" && exit 0;
                sleep 1;
                ((slept++));
            done;
            echo "Unable to connect to ${url} after waiting ${waitFor} times";
            exit 1;
        ' """
    } else {
        bat """
            powershell.exe -c "& { \
                \$slept=0; \
                do { \
                    curl.exe --silent ${url} >\$null; \
                    if (\$?) { \
                        echo \\"Connected to ${url} after waiting \$slept times\\"; \
                        exit 0; \
                    } \
                    sleep 1; \
                    \$slept++; \
                } while (\$slept -lt ${waitFor}); \
                echo \\"Unable to connect to ${url} after waiting \$slept times\\"; \
                exit 1; \
            }"
        """
    }
}

// Need to separate this out because cause is not serializable and thus state
// cannot be saved. @NonCPS makes this method run as native and thus cannot be
// re-entered.
@NonCPS
def getCauseString() {
    def cause = currentBuild.getRawBuild().getCause(hudson.model.Cause)
    if (cause in hudson.model.Cause.UpstreamCause) {
        return "upstream"
    } else if (cause in hudson.model.Cause.UserIdCause) {
        return "user: ${cause.getUserName()}"
    } else {
        return "other"
    }
}

def testNixGo(prefix) {
    dir('go') {
        waitForURL(prefix, env.KEYBASE_SERVER_URI)
        sh './test/run_tests.sh'
    }
}

def nodeWithCleanup(label, handleError, cleanup, closure) {
    def wrappedClosure = {
        try {
            deleteDir()
            closure()
        } catch (ex) {
            try {
                handleError()
            } catch (ex2) {
                println "Unable to handle error: ${ex2.getMessage()}"
            }
            throw ex
        } finally {
            try {
                cleanup()
            } catch (ex2) {
                println "Unable to cleanup: ${ex2.getMessage()}"
            }
            deleteDir()
        }
    }
    node(label, wrappedClosure)
}

def slackOnError(repoName) {
    def message = null
    def color = "warning"
    def cause = getCauseString()
    if (env.CHANGE_ID) {
        message = "<${env.CHANGE_URL}|${env.CHANGE_TITLE}>\n :small_red_triangle: Test failed: <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_DISPLAY_NAME}> by ${env.CHANGE_AUTHOR}"
    } else if (env.BRANCH_NAME == "master" && cause != "upstream" && env.AUTHOR_NAME) {
        def commitUrl = "https://github.com/keybase/${repoName}/commit/${env.COMMIT_HASH}"
        color = "danger"
        message = "*BROKEN: master on keybase/${repoName}*\n :small_red_triangle: Test failed: <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_DISPLAY_NAME}>\n Commit: <${commitUrl}|${env.COMMIT_HASH}>\n Author: ${env.AUTHOR_NAME} &lt;${env.AUTHOR_EMAIL}&gt;"
    }
    if (message) {
        withCredentials([[$class: 'StringBinding',
            credentialsId: 'SLACK_INTEGRATION_TOKEN',
            variable: 'SLACK_INTEGRATION_TOKEN',
        ]]) {
            slackSend([
                channel: "#ci-notify",
                color: color,
                message: message,
                teamDomain: "keybase",
                token: "${env.SLACK_INTEGRATION_TOKEN}"
            ])
        }
    }
}
