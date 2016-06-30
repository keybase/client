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
            docker.withRegistry("https://docker.io", "docker-hub-creds") {
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
                sh "while ! curl -I localhost:3000 2>&1 >/dev/null; do sleep 1; done"
                def local = new URL ("http://169.254.169.254/latest/meta-data/local-ipv4").getText()
                println "Running on host $local"

                stage "Test"
                    parallel (
                        test_linux: {
                            parallel (
                                test_linux_go: {
                                    dir("go") {
                                        sh "test/run_tests.sh || (docker logs ${kbweb.id}; exit 1)"
                                    }
                                },
                                test_linux_js: {
                                    // TODO streamline this a bit
                                    env.PATH="${env.HOME}/.node/bin:${env.PATH}"
                                    env.NODE_PATH="${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}"
                                    if (fileExists("desktop/npm-vendor.js")) {
                                        dir("desktop") {
                                            sh "npm run vendor-install"
                                            sh "unzip ./js-vendor-desktop/flow/flow-linux64*.zip"
                                            sh "./flow/flow"
                                        }
                                    } else {
                                        dir("desktop") {
                                            sh "./packaging/npm_mess.sh"
                                        }
                                        dir("shared") {
                                            sh 'npm i -g flow-bin@$(tail -n1 .flowconfig)'
                                            sh "./flow"
                                        }
                                    }
                                    sh "desktop/node_modules/.bin/eslint ."
                                    dir("protocol") {
                                        sh "./diff_test.sh"
                                    }
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
                                            // TODO implement visdiff to S3
                                        }
                                    }
                                },
                            )
                        },
                        test_windows: {
                            node('windows') {
                                env.GOPATH=pwd()
                                env.GO15VENDOREXPERIMENT=1

                                ws("${env.GOPATH}/src/github.com/keybase/client") {
                                    println "Checkout Windows"
                                        checkout scm

                                    println "Test Windows"
                                        parallel (
                                            test_windows_go: {
                                            },
                                            test_windows_js: {
                                            },
                                        )
                                }
                            }
                        },
                        test_osx: {
                            node('osx') {
                                println "Checkout OS X"
                                    checkout scm

                                println "Test OS X"
                            }
                        },
                    )
            }


        stage "Dockerize"

            def clientImage = docker.image("keybaseprivate/kbclient")


        stage "Integrate"

            // TODO trigger downstream builds


        stage "Push"

            if (env.BRANCH_NAME == "master" && cause != "upstream") {
                docker.withRegistry("https://docker.io", "docker-hub-creds") {
                    kbwebImage.push()
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
