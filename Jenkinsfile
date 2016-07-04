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
        [$class: "ParametersDefinitionProperty",
            parameterDefinitions: [
                [$class: 'StringParameterDefinition',
                    name: 'kbwebNodePrivateIP',
                    defaultValue: '',
                    description: 'The private IP of the node running kbweb',
                ],
                [$class: 'StringParameterDefinition',
                    name: 'kbwebNodePublicIP',
                    defaultValue: '',
                    description: 'The public IP of the node running kbweb',
                ],
                [$class: 'StringParameterDefinition',
                    name: 'clientProjectName',
                    defaultValue: '',
                    description: 'The project name of the upstream client',
                ],
            ]
        ],
    ])

    env.GOPATH=pwd()
    env.GO15VENDOREXPERIMENT=1

    ws("${env.GOPATH}/src/github.com/keybase/kbfs") {
        def kbwebImage = docker.image("keybaseprivate/kbweb")
        def clientImage = docker.image("keybaseprivate/kbclient")
        def kbfsImage = null


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
                    //    gregorImage.pull()
                    //},
                    pull_kbweb: {
                        if (kbwebNodePrivateIP == '' || kbwebNodePublicIP == '') {
                            kbwebImage.pull()
                        }
                    },
                    pull_kbclient: {
                        if (cause == "upstream" && clientProjectName != '') {
                            step([$class: 'CopyArtifact',
                                    projectName: "${clientProjectName}",
                                    filter: 'kbclient.tar',
                                    fingerprintArtifacts: true,
                                    selector: [$class: 'TriggeredBuildSelector',
                                        allowUpstreamDependencies: false,
                                        fallbackToLastSuccessful: false,
                                        upstreamFilterStrategy: 'UseGlobalSetting'],
                                    target: '.'])
                            "docker load -i kbclient.tar"
                        } else {
                            clientImage.pull()
                        }
                    },
                    remove_dockers: {
                        sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
                        sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
                    },
                )
            }

            def kbweb = null

            try {
                if (kbwebNodePrivateIP == '' || kbwebNodePublicIP == '') {
                    retry(5) {
                        kbweb = kbwebImage.run('-p 3000:3000 -p 9911:9911 --entrypoint run/startup_for_container.sh')
                    }
                    kbwebNodePrivateIP = new URL ("http://169.254.169.254/latest/meta-data/local-ipv4").getText()
                    kbwebNodePublicID = new URL ("http://169.254.169.254/latest/meta-data/public-ipv4").getText()
                }

                stage "Test"
                parallel (
                    test_linux: {
                        runNixTest()
                    },
                    test_windows: {
                        node('windows-pipeline') {
                        withEnv([
                            'GOROOT=C:\\tools\\go',
                            "GOPATH=\"${pwd()}\"",
                            'PATH+TOOLS="C:\\tools\\go\\bin";"C:\\Program Files (x86)\\GNU\\GnuPG";',
                            "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                            "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                        ]) {
                        ws("${pwd()}/src/github.com/keybase/client") {
                            println "Checkout Windows"
                            checkout scm

                            println "Test Windows"
                            // TODO Implement Windows test
                        }}}
                    },
                    test_osx: {
                        node('osx') {
                        withEnv([
                            "GOPATH=${pwd()}",
                            "KEYBASE_SERVER_URI=http://${kbwebNodePublicIP}:3000",
                            "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                        ]) {
                        ws("${pwd()}/src/github.com/keybase/kbfs") {
                            println "Checkout OS X"
                                checkout scm

                            println "Test OS X"
                                runNixTest()
                        }}}
                    },
                    integrate: {
                        sh "go install github.com/keybase/kbfs/kbfsfuse"
                        sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                        kbfsImage = docker.build("keybaseprivate/kbfsfuse", "kbfsfuse")
                        sh "docker save -o kbfsfuse.tar keybaseprivate/kbfsfuse"
                        archive("kbfsfuse.tar")
                        // TODO Implement kbfs-server test
                        //build([
                        //    job: "/kbfs-server/master",
                        //    parameters: [
                        //        [$class: 'StringParameterValue',
                        //            name: 'kbfsProjectName',
                        //            value: env.JOB_NAME,
                        //        ],
                        //    ]
                        //])
                    },
                )
            } finally {
                if (kbweb != null) {
                    kbweb.stop()
                }
            }




        stage "Integrate"

            // TODO trigger downstream builds


        stage "Push"

            if (env.BRANCH_NAME == "master" && cause != "upstream") {
                docker.withRegistry("https://docker.io", "docker-hub-creds") {
                    kbfsImage.push()
                }
            } else {
                println "Not pushing docker"
            }
    }
}

def runNixTest() {
    withEnv([
        'KEYBASE_TEST_BSERVER_ADDR=tempdir',
        'KEYBASE_TEST_MDSERVER_ADDR=tempdir',
    ]) {
    parallel (
        vet: {
            sh 'go get -u github.com/golang/lint/golint'
            sh 'go install github.com/golang/lint/golint'
            sh '''
                lint=$(make -s lint);
                echo 2>&1 "$lint";
                [ -z "$lint" -o "$lint" = "Lint-free!" ]
            '''
            sh 'go vet $(go list ./... 2>/dev/null | grep -v /vendor/)'
        },
        install: {
            sh 'go install github.com/keybase/kbfs/...'
        },
        libkbfs: {
            dir('libkbfs') {
                sh 'go test -i'
                sh 'go test -race -c'
                sh './libkbfs.test -test.timeout 2m'
            }
        },
        libfuse: {
            dir('libfuse') {
                sh 'go test -i'
                sh 'go test -c'
                sh './libfuse.test -test.timeout 2m'
            }
        },
        test: {
            dir('test') {
                sh 'go test -i -tags fuse'
                println "Test Dir with Race but no Fuse"
                sh 'go test -race -c'
                sh './test.test -test.timeout 7m'
                println "Test Dir with Fuse but no Race"
                sh 'go test -c -tags fuse'
                sh './test.test -test.timeout 7m'
            }
        },
    )}
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
