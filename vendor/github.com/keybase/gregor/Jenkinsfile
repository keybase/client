#!groovy

node("linux") {
    properties([
            [$class: "BuildDiscarderProperty",
                strategy: [$class: "LogRotator",
                    numToKeepStr: "30",
                    daysToKeepStr: "10",
                    artifactNumToKeepStr: "1",
                ]
            ],
    ])
    def GOPATH=pwd()
    dir("${GOPATH}/bin") {
        deleteDir()
    }

    ws("${GOPATH}/src/github.com/keybase/gregor") {

        def mysqlImage = docker.image("keybaseprivate/mysql")
        env.MYSQL_DSN="root:secret@/test"
        env.GOPATH="${GOPATH}"
        env.GO15VENDOREXPERIMENT=1

        stage "Setup"
        println "Setting up build: ${env.BUILD_TAG}"
        def cause = getCauseString()
        println "Cause: ${cause}"
        parallel (
            checkout: { checkout scm },
            pull_mysql: {
                docker.withRegistry("https://docker.io", "docker-hub-creds") {
                    mysqlImage.pull()
                }
            }
        )

        mysqlImage.withRun("-p 3306:3306 -e DATABASES=test,gregor") {mysql ->
            parallel (
                wait_mysql: {
                    sh "docker exec ${mysql.id} sh -c \"until mysqladmin -uroot -psecret status 2>/dev/null; do sleep .1; done\""
                },
                go_deps: {
                    sh "go get -t ./bin/... ./protocol/..."
                }
            )

            stage "Validate"
            dir("protocol") {
                sh "npm i && git diff --quiet --exit-code"
            }
            sh "$GOPATH/bin/dbinit -y"

            stage "Test"
            sh "go test ./..."

        }

        stage "Dockerize"
        sh "cp $GOPATH/bin/gregord bin/gregord/gregord"
        sh "cp $GOPATH/bin/dbinit bin/dbinit/dbinit"
        def gregorImage = docker.build("keybaseprivate/kbgregor", "bin")
        def kbgregor = "kbgregor_${env.BUILD_TAG}.tar"
        sh "docker save -o $kbgregor keybaseprivate/kbgregor"
        stash(name: kbgregor, includes: kbgregor)

        stage "Integrate"
        // build "/keybase-api-server"

        stage "Push"
        if (env.BRANCH_NAME == "master" && cause != "upstream") {
            docker.withRegistry("https://docker.io", "docker-hub-creds") {
                gregorImage.push()
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
