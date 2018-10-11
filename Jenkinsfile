#!groovy

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

helpers.rootLinuxNode(env, {
    helpers.slackOnError("kbfs", env, currentBuild)
}, {}) {
    properties([
        [$class: "BuildDiscarderProperty",
            strategy: [$class: "LogRotator",
                numToKeepStr: "300",
                daysToKeepStr: "30",
                artifactNumToKeepStr: "1",
            ]
        ],
        [$class: 'RebuildSettings',
            autoRebuild: true,
        ],
        parameters([
            string(
                name: 'kbwebNodePrivateIP',
                defaultValue: '',
                description: 'The private IP of the node running kbweb',
            ),
            // TODO: deprecated, remove once no client builds are left that
            // send this variable.
            string(
                name: 'kbwebNodePublicIP',
                defaultValue: '',
                description: 'The public IP of the node running kbweb',
            ),
            string(
                name: 'clientProjectName',
                defaultValue: '',
                description: 'The project name of the upstream client',
            ),
        ]),
    ])
    def kbwebNodePrivateIP = params.kbwebNodePrivateIP
    def clientProjectName = params.clientProjectName

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
        def startKbweb = kbwebNodePrivateIP == ''
        if (startKbweb) {
            kbwebNodePrivateIP = httpRequest("http://169.254.169.254/latest/meta-data/local-ipv4").content
        }

        stage("Setup") {
            sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
            sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
            sh "docker rmi --no-prune keybaseprivate/mysql keybaseprivate/kbgregor keybaseprivate/kbweb keybaseprivate/kbclient || echo 'No images to remove'"

            docker.withRegistry("", "docker-hub-creds") {
                parallel (
                    checkout: {
                        checkout scm
                        env.AUTHOR_NAME = sh(returnStdout: true, script: 'git --no-pager show -s --format="%an" HEAD').trim()
                        env.AUTHOR_EMAIL = sh(returnStdout: true, script: 'git --no-pager show -s --format="%ae" HEAD').trim()
                        // We need the revision to be baked into the docker
                        // image so we can debug downstream builds, so we make
                        // it a file instead of using `returnStdout`.
                        sh 'echo -n $(git rev-parse HEAD) > kbfsfuse/revision'
                        env.COMMIT_HASH = readFile('kbfsfuse/revision')
                        sh 'git add kbfsfuse/revision'
                        sh "git -c user.name='Jenkins' -c user.email='ci@keyba.se' commit -m 'revision'"
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
            try {

                // Trigger downstream builds
                parallel (
                    //test_windows: {
                    //    helpers.nodeWithCleanup('windows', {}, {}) {
                    //    withEnv([
                    //        'GOROOT=C:\\tools\\go',
                    //        "GOPATH=\"${pwd()}\\go\"",
                    //        'PATH+TOOLS="C:\\tools\\go\\bin";"C:\\Program Files (x86)\\GNU\\GnuPG";',
                    //        "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                    //        "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
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
                        def mountDir='/Volumes/untitled/kbfs'
                        helpers.nodeWithCleanup('macstadium', {}, {
                                sh "rm -rf ${mountDir} || echo 'Something went wrong with cleanup.'"
                            }) {
                            def BASEDIR=pwd()
                            def GOPATH="${BASEDIR}/go"
                            dir(mountDir) {
                                sh "touch test.txt"
                            }
                            withEnv([
                                "PATH=${env.PATH}:${GOPATH}/bin",
                                "GOPATH=${GOPATH}",
                                "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                                "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                                "TMPDIR=${mountDir}",
                                "GOTRACEBACK=all",
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
                    test_kbfs: {
                        // Install kbfsfuse first so we can start on dockerizing.
                        sh "go install github.com/keybase/kbfs/kbfsfuse"
                        sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                        sh "go install github.com/keybase/kbfs/kbfsgit/git-remote-keybase"
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

                        parallel (
                            test_linux: {
                                // JZ: Currently FUSE tests are failing on
                                // linux.  Disable until we can investigate the
                                // busted machine situation.
                                if (false && startKbweb) {
                                    parallel (
                                        pull_mysql: {
                                            mysqlImage.pull()
                                        },
                                        pull_gregor: {
                                            gregorImage.pull()
                                        },
                                        pull_kbweb: {
                                            kbwebImage.pull()
                                        },
                                    )
                                    retry(5) {
                                        sh "docker-compose up -d mysql.local"
                                    }
                                    sh "docker-compose up -d kbweb.local"

                                    withEnv([
                                        "PATH=${env.PATH}:${env.GOPATH}/bin",
                                        "GOTRACEBACK=all",
                                    ]) {
                                        runNixTest('linux_')
                                    }
                                }
                            },
                            integrate: {
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
            def isUpstreamMaster = clientProjectName == "client/master"
            if (env.BRANCH_NAME == "master" && (cause != "upstream" || isUpstreamMaster)) {
                docker.withRegistry("", "docker-hub-creds") {
                    kbfsImage.push()
                }
            } else {
                println "Not pushing docker. Branch: \"${env.BRANCH_NAME}\", Cause: \"${cause}\", Client project: \"${clientProjectName}\""
            }
        }
    }
}

def runNixTest(prefix) {
    retry(5) {
        sh 'go get -u golang.org/x/lint/golint github.com/golang/mock/gomock github.com/golang/mock/mockgen'
    }

    // Avoid build specific errors by compiling for production.
    sh 'go build --tags=production ./...'

    tests = [:]
    // Run libkbfs tests with an in-memory bserver and mdserver, and run
    // all other tests with the tempdir bserver and mdserver.
    tests[prefix+'gofmt'] = {
        sh 'test -z $(gofmt -l $(go list ./... 2>/dev/null | grep -v /vendor/ | sed -e s/github.com.keybase.kbfs.// ))'
    }
    tests[prefix+'notestingdep'] = {
        // Make sure we don't accidentally pull in the testing package.
        sh '! go list -f \'{{ join .Deps "\\n" }}\' github.com/keybase/kbfs/kbfsfuse | grep testing'
    }
    tests[prefix+'vet'] = {
        sh 'make -s lint'
        sh 'go vet $(go list ./... 2>/dev/null | grep -v /vendor/)'
    }
    tests[prefix+'gen_mocks'] = {
        dir('libkbfs') {
            // Make sure our mock library is up to date.
            sh './gen_mocks.sh'
            sh 'git diff --exit-code'
        }
    }
    parallel (tests)
    // Dependencies
    dir('test') {
        sh 'go test -i -tags fuse'
    }

    // Build out the test dependencies first, otherwise the we might have
    // concurrent build issues when running in parallel.
    //
    // NOTE that this assumes with the dependencies installed here, `go test
    // -c` below will only need to build local packages and link, thus no race
    // should happen. If the assumption is wrong then we still could have
    // races.
    sh 'go test -i -tags fuse ./...'

    sh 'go install github.com/keybase/kbfs/...'

    // Keep the list below in sync with the result of
    //
    //   for x in $(find . -mindepth 1 \( -wholename ./vendor -o -wholename ./.git \) -prune -o -type d -print); do [ -n "$(ls -A $x/*_test.go 2>/dev/null)" ] && echo $x; done | sort

    tests = [:]

    // dokan is Windows-only.

    tests[prefix+'kbfsblock'] = {
        dir('kbfsblock') {
            sh 'go test -race -c'
            sh './kbfsblock.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfscodec'] = {
        dir('kbfscodec') {
            sh 'go test -race -c'
            sh './kbfscodec.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfscrypto'] = {
        dir('kbfscrypto') {
            sh 'go test -race -c'
            sh './kbfscrypto.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfsedits'] = {
        dir('kbfsedits') {
            sh 'go test -race -c'
            sh './kbfsedits.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfsgit'] = {
        dir('kbfsgit') {
            sh 'go test -race -c'
            sh './kbfsgit.test -test.timeout 10m'
        }
    }
    tests[prefix+'kbfshash'] = {
        dir('kbfshash') {
            sh 'go test -race -c'
            sh './kbfshash.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfsmd'] = {
        dir('kbfsmd') {
            sh 'go test -race -c'
            sh './kbfsmd.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbfssync'] = {
        dir('kbfssync') {
            sh 'go test -race -c'
            sh './kbfssync.test -test.timeout 30s'
        }
    }
    tests[prefix+'kbpagesconfig'] = {
        dir('kbpagesconfig') {
            sh 'go test -race -c'
            sh './kbpagesconfig.test -test.timeout 30s'
        }
    }

    // libdokan is Windows-only.

    tests[prefix+'libfs'] = {
        dir('libfs') {
            sh 'go test -race -c'
            sh './libfs.test -test.timeout 10m'
        }
    }
    tests[prefix+'libfuse'] = {
        dir('libfuse') {
            sh 'go test -c'
            sh './libfuse.test -test.timeout 3m'
        }
    }
    tests[prefix+'libgit'] = {
        dir('libgit') {
            sh 'go test -race -c'
            sh './libgit.test -test.timeout 10m'
        }
    }
    tests[prefix+'libhttpserver'] = {
        dir('libhttpserver') {
            sh 'go test -race -c'
            sh './libhttpserver.test -test.timeout 30s'
        }
    }
    tests[prefix+'libkbfs'] = {
        dir('libkbfs') {
            sh 'go test -race -c'
            sh './libkbfs.test -test.timeout 5m'
        }
    }
    tests[prefix+'libpages'] = {
        dir('libpages') {
            sh 'go test -race -c'
            sh './libpages.test -test.timeout 30s'
        }
    }
    tests[prefix+'libpages_config'] = {
        dir('libpages/config') {
            sh 'go test -race -c'
            sh './config.test -test.timeout 30s'
        }
    }
    tests[prefix+'simplefs'] = {
        dir('simplefs') {
            sh 'go test -c'
            sh './simplefs.test -test.timeout 2m'
        }
    }
    tests[prefix+'test_race'] = {
        dir('test') {
            println "Test with Race but no Fuse"
            sh 'go test -race -c -o test.race'
            sh './test.race -test.timeout 12m'
        }
    }
    tests[prefix+'test_fuse'] = {
        dir('test') {
            println "Test with Fuse but no Race"
            sh 'go test -c -tags fuse -o test.fuse'
            sh './test.fuse -test.timeout 12m'
        }
    }
    tests[prefix+'tlf'] = {
        dir('tlf') {
            sh 'go test -race -c'
            sh './tlf.test -test.timeout 30s'
        }
    }
    parallel (tests)
}
