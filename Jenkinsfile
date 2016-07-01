#!groovy

node("ec2-fleet") {
    properties([
            [$class: "BuildDiscarderProperty",
                strategy: [$class: "LogRotator",
                    numToKeepStr: "30",
                    daysToKeepStr: "10",
                    artifactNumToKeepStr: "1",
                ]
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

    env.GOPATH=pwd()
    env.GO15VENDOREXPERIMENT=1

    ws("${env.GOPATH}/src/github.com/keybase/client") {
        def mysqlImage = docker.image("keybaseprivate/mysql")
        def gregorImage = docker.image("keybaseprivate/kbgregor")
        def kbwebImage = docker.image("keybaseprivate/kbweb")


        stage "Setup"

            println "Setting up build: ${env.BUILD_TAG}"
            def cause = getCauseString()
            println "Cause: ${cause}"
            docker.withRegistry("", "docker-hub-creds") {
                parallel (
                    checkout: { checkout scm },
                    // TODO: take gregor and mysql out of kbweb
                    //pull_mysql: {
                    //    mysqlImage.pull()
                    //},
                    //pull_gregor: {
                    //    if (cause == "upstream" && gregorProjectName != '') {
                    //        step([$class: 'CopyArtifact',
                    //                projectName: "${gregorProjectName}",
                    //                filter: 'kbgregor.tar',
                    //                fingerprintArtifacts: true,
                    //                selector: [$class: 'TriggeredBuildSelector',
                    //                    allowUpstreamDependencies: false,
                    //                    fallbackToLastSuccessful: false,
                    //                    upstreamFilterStrategy: 'UseGlobalSetting'],
                    //                target: '.'])
                    //        "docker load -i kbgregor.tar"
                    //    } else {
                    //        gregorImage.pull()
                    //    }
                    //},
                    pull_kbweb: {
                        sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
                        sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
                        if (cause == "upstream" && kbwebProjectName != '') {
                            step([$class: 'CopyArtifact',
                                    projectName: "${kbwebProjectName}",
                                    filter: 'kbweb.tar',
                                    fingerprintArtifacts: true,
                                    selector: [$class: 'TriggeredBuildSelector',
                                        allowUpstreamDependencies: false,
                                        fallbackToLastSuccessful: false,
                                        upstreamFilterStrategy: 'UseGlobalSetting'],
                                    target: '.'])
                            "docker load -i kbkbweb.tar"
                        } else {
                            kbwebImage.pull()
                        }
                    },
                )
            }

            kbwebImage.withRun('-p 3000:3000 -p 9911:9911 --entrypoint run/startup_for_container.sh') {kbweb->
                def local = new URL ("http://169.254.169.254/latest/meta-data/local-ipv4").getText()
                def pub = new URL ("http://169.254.169.254/latest/meta-data/public-ipv4").getText()
                println "Running on host $local"

                stage "Test"
                    parallel (
                        test_linux: {
                            parallel (
                                test_linux_go: {
                                    dir("go") {
                                        sh "(while ! curl -s -o /dev/null localhost:3000 2>&1; do sleep 1; done)"
                                        sh "test/run_tests.sh || (docker logs ${kbweb.id}; exit 1)"
                                    }
                                },
                                test_linux_js: { withEnv([
                                    "PATH+NODE=${env.HOME}/.node/bin:",
                                    "NODE_PATH+NODE=${env.HOME}/.node/lib/node_modules:"
                                ]) {
                                    // TODO implement PR ID
                                    if (fileExists("desktop/npm-vendor.js")) {
                                        dir("desktop") {
                                            sh "npm run vendor-install"
                                            sh "unzip ./js-vendor-desktop/flow/flow-linux64*.zip"
                                            sh "./flow/flow"
                                        }
                                    } else {
                                        dir("desktop") {
                                            sh "../packaging/npm_mess.sh"
                                        }
                                        dir("shared") {
                                            sh 'npm i -g flow-bin@$(tail -n1 .flowconfig)'
                                            sh "flow"
                                        }
                                    }
                                    sh "desktop/node_modules/.bin/eslint ."
                                    dir("protocol") {
                                        sh "./diff_test.sh"
                                    }
                                    withCredentials([[$class: 'UsernamePasswordMultiBinding',
                                            credentialsId: 'visdiff-aws-creds',
                                            usernameVariable: 'visdiffAccessKeyId',
                                            passwordVariable: 'visdiffAccessSecret',
                                        ],[$class: 'StringBinding',
                                            credentialsId: 'visdiff-github-token',
                                            variable: 'visdiffGithubToken',
                                    ]]) {
                                    withEnv([
                                        "VISDIFF_AWS_ACCESS_KEY_ID=${visdiffAccessKeyId}",
                                        "VISDIFF_AWS_SECRET_ACCESS_KEY=${visdiffAccessSecret}",
                                        "VISDIFF_GH_TOKEN=${visdiffGithubToken}",
                                    ]) {
                                        if (fileExists("visdiff")) {
                                            dir("visdiff") {
                                                sh "npm install"
                                            }
                                            sh "npm install ./visdiff"
                                            dir("desktop") {
                                                sh "../node_modules/.bin/keybase-visdiff HEAD^...HEAD"
                                            }
                                        } else {
                                            dir("desktop") {
                                                sh "echo -e '[default]\\naccess_key = ${visdiffAccessKeyId}\\nsecret_key = ${visdiffAccessSecret}' > ~/.s3cfg;"
                                                sh "npm install octonode"
                                                sh "npm run visdiff -- \"`git rev-parse HEAD^1`...`git rev-parse HEAD`\""
                                            }
                                        }
                                    }}
                                }},
                            )
                        },
                        test_windows: {
                            node('windows-pipeline') {
                            withEnv([
                                'GOROOT=C:\\tools\\go',
                                "GOPATH=\"${pwd()}\"",
                                'PATH+TOOLS="C:\\tools\\go\\bin";"C:\\Program Files (x86)\\GNU\\GnuPG";"C:\\Program Files\\nodejs";"C:\\tools\\python";"C:\\Program Files\\graphicsmagick-1.3.24-q8";',
                                "KEYBASE_SERVER_URI=http://${local}:3000",
                                "KEYBASE_PUSH_SERVER_URI=fmprpc://${local}:9911",
                            ]) {
                            ws("${pwd()}/src/github.com/keybase/client") {
                                println "Checkout Windows"
                                checkout scm

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
                                            bat "powershell -Command \"do { curl.exe --silent --output curl.txt http://${local}:3000; \$res = \$?; sleep 1 } while (\$res -ne '0')\""
                                            bat "for /f %%i in (testlist.txt) do (go test -timeout 30m %%i || exit /B 1)"
                                        }
                                    },
                                    test_windows_js: {
                                        println "Test Windows JS"
                                        // TODO implement visdiff PR pushing
                                        if (fileExists("visdiff")) {
                                            bat "choco install -y nodejs.install --allow-downgrade --version 6.1.0"
                                            bat "choco install -y python --version 2.7.11"
                                            bat "choco install -y graphicsmagick --version 1.3.24"
                                            dir("visdiff") {
                                                bat "npm install"
                                            }
                                            bat "npm install .\\visdiff"
                                            dir("desktop") {
                                                if (fileExists("npm-vendor.js")) {
                                                    bat "npm run vendor-install"
                                                } else {
                                                    bat "npm install"
                                                }
                                                withCredentials([[$class: 'UsernamePasswordMultiBinding',
                                                        credentialsId: 'visdiff-aws-creds',
                                                        usernameVariable: 'visdiffAccessKeyId',
                                                        passwordVariable: 'visdiffAccessSecret',
                                                    ],[$class: 'StringBinding',
                                                        credentialsId: 'visdiff-github-token',
                                                        variable: 'visdiffGithubToken',
                                                ]]) {
                                                withEnv([
                                                    "VISDIFF_AWS_ACCESS_KEY_ID=${visdiffAccessKeyId}",
                                                    "VISDIFF_AWS_SECRET_ACCESS_KEY=${visdiffAccessSecret}",
                                                    "VISDIFF_GH_TOKEN=${visdiffGithubToken}",
                                                ]) {
                                                    bat '..\\node_modules\\.bin\\keybase-visdiff "HEAD^^...HEAD"'
                                                }}
                                            }
                                        }
                                    },
                                )
                            }}}
                        },
                        test_osx: {
                            node('osx') {
                            withEnv([
                                "GOPATH=${pwd()}",
                                "KEYBASE_SERVER_URI=http://${pub}:3000",
                                "KEYBASE_PUSH_SERVER_URI=fmprpc://${pub}:9911",
                            ]) {
                            ws("${pwd()}/src/github.com/keybase/client") {
                                println "Checkout OS X"
                                    checkout scm

                                println "Test OS X"
                                    dir('go') {
                                        sh './test/run_tests.sh'
                                    }
                            }}}
                        },
                    )
            }


        stage "Dockerize"

            dir('go') {
                sh "go install github.com/keybase/client/go/keybase"
                sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                def clientImage = docker.build("keybaseprivate/kbclient")
            }


        stage "Integrate"

            // TODO trigger downstream builds


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

@NonCPS
def copyEnv(env) {
    newEnv = [:]
    for (e in env) {
        newEnv[e.key] = e.value
    }
    return newEnv
}
