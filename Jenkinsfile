#!groovy

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

if (env.CHANGE_TITLE && env.CHANGE_TITLE.contains('[ci-skip]')) {
    println "Skipping build because PR title contains [ci-skip]"
} else {
    helpers.nodeWithCleanup("linux", {
        helpers.slackOnError("client", env, currentBuild)
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

        def cause = helpers.getCauseString(currentBuild)
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
                                dir("protocol") {
                                    sh "./diff_test.sh"
                                }
                                parallel (
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
                                )
                            },
                        )
                } catch (ex) {
                    println "Gregor logs:"
                    sh "docker-compose logs --tail=10000 gregor.local"
                    println "MySQL logs:"
                    sh "docker-compose logs --tail=10000 mysql.local"
                    println "KBweb logs:"
                    sh "docker-compose logs --tail=10000 kbweb.local"
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

def testNixGo(prefix) {
    dir('go') {
        helpers.waitForURL(prefix, env.KEYBASE_SERVER_URI)
        sh './test/run_tests.sh'
    }
}
