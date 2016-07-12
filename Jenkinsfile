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

    env.GOPATH=pwd()
    def mysqlImage = docker.image("keybaseprivate/mysql")
    def gregorImage = docker.image("keybaseprivate/kbgregor")
    def kbwebImage = docker.image("keybaseprivate/kbweb")
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



            docker.withRegistry("", "docker-hub-creds") {
                parallel (
                    checkout: {
                        checkout scm
                        sh "git rev-parse HEAD | tee go/revision"
                        sh "git add go/revision"
                    },
                    // TODO: take gregor and mysql out of kbweb
                    //pull_mysql: {
                    //    mysqlImage.pull()
                    //},
                    //pull_gregor: {
                    //    gregorImage.pull()
                    //},
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
                    kbweb = kbwebImage.run('-p 3000:3000 -p 9911:9911 --entrypoint run/startup_for_container.sh')
                }

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
                                ]) {
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
                                    sh "npm ls"
                                    sh "ls desktop/node_modules"
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
                                            if (fileExists("visdiff")) {
                                                dir("visdiff") {
                                                    sh "npm install"
                                                }
                                                sh "npm install ./visdiff"
                                                dir("desktop") {
                                                    sh "../node_modules/.bin/keybase-visdiff 'merge-base(origin/master, HEAD)...HEAD'"
                                                }
                                            } else {
                                                dir("desktop") {
                                                    sh 'echo -e "[default]\\naccess_key = $VISDIFF_AWS_ACCESS_KEY_ID\\nsecret_key = $VISDIFF_AWS_SECRET_ACCESS_KEY" > ~/.s3cfg;'
                                                    sh "npm install octonode"
                                                    sh "npm run visdiff -- \"`git merge-base origin/master HEAD`...`git rev-parse HEAD`\""
                                                }
                                            }
                                        }}}
                                    }
                                }},
                                test_kbfs: {
                                    dir('go') {
                                        sh "go install github.com/keybase/client/go/keybase"
                                        sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                                        clientImage = docker.build("keybaseprivate/kbclient")
                                        sh "docker save -o kbclient.tar keybaseprivate/kbclient"
                                        archive("kbclient.tar")
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
                            node('windows') {
                                def GOPATH=pwd()
                                withEnv([
                                    'GOROOT=C:\\tools\\go',
                                    "GOPATH=\"${GOPATH}\"",
                                    "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";${env.PATH}",
                                    "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                    "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                ]) {
                                ws("${GOPATH}/src/github.com/keybase/client") {
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
                                                waitForURL("Windows", env.KEYBASE_SERVER_URI)
                                                bat "for /f %%i in (testlist.txt) do (go test -timeout 10m %%i || exit /B 1)"
                                            }
                                        },
                                        test_windows_js: {
                                        // Only run visdiff for PRs
                                        if (env.CHANGE_ID) {
                                        wrap([$class: 'Xvfb']) {
                                            println "Test Windows JS"
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
                                            }
                                        }}},
                                    )
                                }}
                            }
                        },
                        test_osx: {
                            node('osx') {
                                def GOPATH=pwd()
                                withEnv([
                                    "GOPATH=${GOPATH}",
                                    "PATH=${env.PATH}:${GOPATH}/bin",
                                    "KEYBASE_SERVER_URI=http://${kbwebNodePublicIP}:3000",
                                    "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                                ]) {
                                ws("${GOPATH}/src/github.com/keybase/client") {
                                    println "Checkout OS X"
                                        checkout scm

                                    println "Test OS X"
                                        testNixGo("OS X")
                                }}
                            }
                        },
                    )
            } finally {
                if (kbweb != null) {
                    kbweb.stop()
                }
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

def waitForURL(prefix, url) {
    def waitFor = 180;
    if (isUnix()) {
        sh """ bash -c '
            slept=0
            while [[ "\$slept" -lt "${waitFor}" ]]; do
                curl -s -o /dev/null ${url} && echo "Connected to ${url} after waiting \$slept times" && exit 0;
                sleep 1;
                ((slept++));
            done;
            echo "Unable to connect to \$url after waiting ${waitFor} times";
            exit 1;
        ' """
    } else {
        bat """
            powershell.exe -c ' \
                \$slept=0; \
                \$res=1; \
                do { \
                    curl.exe --silent ${url} >nul 2>&1 && echo "Connected to ${url} after waiting \$slept times" && exit 0; \
                    sleep 1; \
                    \$slept++; \
                } while (\$slept -lt ${waitFor}); \
                echo "Unable to connect to ${url} after waiting ${waitFor} times"; \
                exit 1; \
            '
        """
    }
}

def testNixGo(prefix) {
    dir('go') {
        waitForURL(prefix, env.KEYBASE_SERVER_URI)
        sh './test/run_tests.sh'
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
