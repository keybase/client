#!groovy

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

if (env.CHANGE_TITLE && env.CHANGE_TITLE.contains('[ci-skip]')) {
    println "Skipping build because PR title contains [ci-skip]"
} else {
    helpers.nodeWithCleanup("linux", {
        helpers.slackOnError("kbfs", env, currentBuild)
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

        env.BASEDIR=pwd()
        env.GOPATH="${env.BASEDIR}/go"
        env.GO15VENDOREXPERIMENT=1

        ws("${env.GOPATH}/src/github.com/keybase/kbfs") {
            def mysqlImage = docker.image("keybaseprivate/mysql")
            def gregorImage = docker.image("keybaseprivate/kbgregor")
            def kbwebImage = docker.image("keybaseprivate/kbweb")
            def clientImage = docker.image("keybaseprivate/kbclient")
            def kbfsImage = docker.image("keybaseprivate/kbfsfuse")

            println "Setting up build: ${env.BUILD_TAG}"
            def cause = helpers.getCauseString(currentBuild)
            println "Cause: ${cause}"
            def startKbweb = !binding.variables.containsKey("kbwebNodePrivateIP") || kbwebNodePrivateIP == '' || kbwebNodePublicIP == ''

            stage("Setup") {
                sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
                sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
                sh "docker rmi --no-prune keybaseprivate/mysql keybaseprivate/kbgregor keybaseprivate/kbweb keybaseprivate/kbclient || echo 'No images to remove'"

                docker.withRegistry("", "docker-hub-creds") {
                    parallel (
                        checkout: {
                            checkout scm
                            sh 'echo -n $(git rev-parse HEAD) > kbfsfuse/revision'
                            env.COMMIT_HASH = readFile('kbfsfuse/revision')
                            sh 'echo -n $(git --no-pager show -s --format="%an" HEAD) > .author_name'
                            sh 'echo -n $(git --no-pager show -s --format="%ae" HEAD) > .author_email'
                            env.AUTHOR_NAME = readFile('.author_name')
                            env.AUTHOR_EMAIL = readFile('.author_email')
                            sh 'rm .author_name .author_email'
                        },
                        pull_mysql: {
                            if (startKbweb) {
                                mysqlImage.pull()
                            }
                        },
                        pull_gregor: {
                            if (startKbweb) {
                                gregorImage.pull()
                            }
                        },
                        pull_kbweb: {
                            if (startKbweb) {
                                kbwebImage.pull()
                            }
                        },
                        pull_kbclient: {
                            if (cause == "upstream" && clientProjectName != '') {
                                retry(5) {
                                    step([$class: 'CopyArtifact',
                                            projectName: "${clientProjectName}",
                                            filter: 'kbclient.tar.gz',
                                            fingerprintArtifacts: true,
                                            selector: [$class: 'TriggeredBuildSelector',
                                                allowUpstreamDependencies: false,
                                                fallbackToLastSuccessful: false,
                                                upstreamFilterStrategy: 'UseGlobalSetting'],
                                            target: '.'])
                                    sh "gunzip -c kbclient.tar.gz | docker load"
                                }
                            } else {
                                clientImage.pull()
                            }
                        },
                    )
                }
            }

            stage("Test") {
                def kbweb = null
                try {
                    if (startKbweb) {
                        retry(5) {
                            sh "docker-compose up -d mysql.local"
                        }
                        sh "docker-compose up -d kbweb.local"
                        sh "curl -s http://169.254.169.254/latest/meta-data/public-ipv4 > public.txt"
                        sh "curl -s http://169.254.169.254/latest/meta-data/local-ipv4 > private.txt"
                        kbwebNodePublicIP = readFile('public.txt')
                        kbwebNodePrivateIP = readFile('private.txt')
                        sh "rm public.txt"
                        sh "rm private.txt"
                    }

                    parallel (
                        test_linux: {
                            withEnv([
                                "PATH=${env.PATH}:${env.GOPATH}/bin",
                            ]) {
                                runNixTest('linux_')
                            }
                        },
                        //test_windows: {
                        //    helpers.nodeWithCleanup('windows', {}, {}) {
                        //    withEnv([
                        //        'GOROOT=C:\\tools\\go',
                        //        "GOPATH=\"${pwd()}\\go\"",
                        //        'PATH+TOOLS="C:\\tools\\go\\bin";"C:\\Program Files (x86)\\GNU\\GnuPG";',
                        //        "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                        //        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                        //    ]) {
                        //    deleteDir()
                        //    ws("${pwd()}/src/github.com/keybase/client") {
                        //        println "Checkout Windows"
                        //        checkout scm

                        //        println "Test Windows"
                        //        // TODO Implement Windows test
                        //    }}}
                        //},
                        test_osx: {
                            helpers.nodeWithCleanup('osx', {}, {}) {
                                def BASEDIR=pwd()
                                def GOPATH="${BASEDIR}/go"
                                withEnv([
                                    "PATH=${env.PATH}:${GOPATH}/bin",
                                    "GOPATH=${GOPATH}",
                                    "KEYBASE_SERVER_URI=http://${kbwebNodePublicIP}:3000",
                                    "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePublicIP}:9911",
                                ]) {
                                    ws("${GOPATH}/src/github.com/keybase/kbfs") {
                                        println "Checkout OS X"
                                        checkout scm

                                        println "Test OS X"
                                        runNixTest('osx_')
                                    }
                                }
                            }
                        },
                        integrate: {
                            sh "go install github.com/keybase/kbfs/kbfsfuse"
                            sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                            withCredentials([[$class: 'StringBinding', credentialsId: 'kbfs-docker-cert-b64', variable: 'KBFS_DOCKER_CERT_B64']]) {
                                println "Building Docker"
                                sh '''
                                    set +x
                                    docker build -t keybaseprivate/kbfsfuse --build-arg KEYBASE_TEST_ROOT_CERT_PEM_B64=\"$KBFS_DOCKER_CERT_B64\" kbfsfuse
                                '''
                            }
                            sh "docker save keybaseprivate/kbfsfuse | gzip > kbfsfuse.tar.gz"
                            archive("kbfsfuse.tar.gz")
                            build([
                                job: "/kbfs-server/master",
                                parameters: [
                                    [$class: 'StringParameterValue',
                                        name: 'kbfsProjectName',
                                        value: env.JOB_NAME,
                                    ],
                                ]
                            ])
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
            }

            stage("Push") {
                def isUpstreamMaster = binding.variables.containsKey("clientProjectName") && clientProjectName == "client/master"
                if (env.BRANCH_NAME == "master" && (cause != "upstream" || isUpstreamMaster)) {
                    docker.withRegistry("", "docker-hub-creds") {
                        kbfsImage.push()
                    }
                } else {
                    println "Not pushing docker"
                }
            }
        }
    }
}

def runNixTest(prefix) {
    tests = [:]
    // Run libkbfs tests with an in-memory bserver and mdserver, and run
    // all other tests with the tempdir bserver and mdserver.
    tests[prefix+'gofmt'] = {
        sh 'test -z $(gofmt -l $(go list ./... 2>/dev/null | grep -v /vendor/ | sed -e s/github.com.keybase.kbfs.// ))'
    }
    tests[prefix+'vet'] = {
        sh 'go get -u github.com/golang/lint/golint'
        sh 'go install github.com/golang/lint/golint'
        sh '''
            lint=$(make -s lint);
            echo 2>&1 "$lint";
            [ -z "$lint" -o "$lint" = "Lint-free!" ]
        '''
        sh 'go vet $(go list ./... 2>/dev/null | grep -v /vendor/)'
    }
    tests[prefix+'install'] = {
        sh 'go install github.com/keybase/kbfs/...'
    }
    tests[prefix+'libkbfs'] = {
        dir('libkbfs') {
            sh 'go test -i'
            sh 'go test -race -c'
            sh './libkbfs.test -test.timeout 3m'
        }
    }
    tests[prefix+'libfuse'] = {
        withEnv([
            'KEYBASE_TEST_BSERVER_ADDR=tempdir',
            'KEYBASE_TEST_MDSERVER_ADDR=tempdir',
        ]) {
            dir('libfuse') {
                sh 'go test -i'
                sh 'go test -c'
                sh './libfuse.test -test.timeout 2m'
            }
        }
    }
    tests[prefix+'test'] = {
        withEnv([
            'KEYBASE_TEST_BSERVER_ADDR=tempdir',
            'KEYBASE_TEST_MDSERVER_ADDR=tempdir',
        ]) {
            dir('test') {
                sh 'go test -i -tags fuse'
                println "Test Dir with Race but no Fuse"
                sh 'go test -race -c'
                sh './test.test -test.timeout 7m'
                println "Test Dir with Fuse but no Race"
                sh 'go test -c -tags fuse'
                sh './test.test -test.timeout 7m'
            }
        }
    }
    parallel (tests)
}
