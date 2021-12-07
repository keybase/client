#!groovy

import groovy.json.JsonSlurperClassic

helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

def withKbweb(closure) {
  try {
    withEnv(["COMPOSE_HTTP_TIMEOUT=120"]) {
      withCredentials([
        string(credentialsId: 's3-secrets-access-key-id', variable: 'S3_SECRETS_ACCESS_KEY_ID'),
        string(credentialsId: 's3-secrets-secret-access-key', variable: 'S3_SECRETS_SECRET_ACCESS_KEY'),
      ]) {
        // Coyne: I logged this next line to confirm it was coming through
        // println "Using S3 Secrets AccessKeyID with length = ${env.S3_SECRETS_ACCESS_KEY_ID.length()}"
        retry(5) {
          sh "docker-compose down"
          sh "docker-compose up -d mysql.local"
        }
        // Give MySQL a few seconds to start up.
        sleep(10)
        sh "docker-compose up -d kbweb.local"
      }
    }

    closure()
  } catch (ex) {
    def kbwebName = helpers.containerName('docker-compose', 'kbweb')
    println "kbweb is running in ${kbwebName}"

    println "Dockers:"
    sh "docker ps -a"
    sh "docker-compose stop"
    helpers.logContainer('docker-compose', 'mysql')
    logKbwebServices(kbwebName)
    throw ex
  } finally {
    sh "docker-compose down"
  }
}

def logKbwebServices(container) {
  sh "docker cp ${container}:/keybase/logs ./kbweb-logs"
  sh "tar -C kbweb-logs -czvf kbweb-logs.tar.gz ."
  archive("kbweb-logs.tar.gz")
}

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
    parameters([
        string(
            name: 'kbwebProjectName',
            defaultValue: '',
            description: 'The project name of the upstream kbweb build',
        ),
    ]),
  ])

  def kbwebProjectName = env.kbwebProjectName
  def cause = helpers.getCauseString(currentBuild)
  println "Cause: ${cause}"
  println "Pull Request ID: ${env.CHANGE_ID}"

  env.BASEDIR=pwd()
  env.GOPATH="${env.BASEDIR}/go"
  def kbwebTag = cause == 'upstream' && kbwebProjectName != '' ? kbwebProjectName : 'master'
  def images = [
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/glibc"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/mysql"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/sqsd"),
    docker.image("897413463132.dkr.ecr.us-east-1.amazonaws.com/kbweb:${kbwebTag}"),
  ]
  def kbfsfuseImage

  def kbwebNodePrivateIP = httpRequest("http://169.254.169.254/latest/meta-data/local-ipv4").content

  println "Running on host $kbwebNodePrivateIP"
  println "Setting up build: ${env.BUILD_TAG}"

  ws("client") {

    stage("Setup") {
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
        pull_images: {
          docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
            for (i in images) {
              i.pull()
              i.tag('latest')
            }
          }
        },
        remove_dockers: {
          sh 'docker stop $(docker ps -q) || echo "nothing to stop"'
          sh 'docker rm $(docker ps -aq) || echo "nothing to remove"'
        },
      )
    }

    def goChanges = helpers.getChangesForSubdir('go', env)
    def hasGoChanges = goChanges.size() != 0
    def hasJSChanges = helpers.hasChanges('shared', env)
    def hasJenkinsfileChanges = helpers.getChanges(env.COMMIT_HASH, env.CHANGE_TARGET).findIndexOf{ name -> name =~ /Jenkinsfile/ } >= 0
    def hasKBFSChanges = false
    println "Has go changes: " + hasGoChanges
    println "Has JS changes: " + hasJSChanges
    println "Has Jenkinsfile changes: " + hasJenkinsfileChanges
    def dependencyFiles = [:]

    if (hasGoChanges && env.CHANGE_TARGET && !hasJenkinsfileChanges) {
      dir("go") {
        sh "make gen-deps"
        dependencyFiles = [
          linux: sh(returnStdout: true, script: "cat .go_package_deps_linux"),
          windows: sh(returnStdout: true, script: "cat .go_package_deps_windows"),
        ]
      }
    }

    stage("Test") {
      withKbweb() {
        parallel (
          failFast: true,
          test_linux: {
            def packagesToTest = [:]
            if (hasGoChanges || hasJenkinsfileChanges) {
              // Check protocol diffs
              // Clean the index first
              sh "git add -A"
              // Generate protocols
              dir ('protocol') {
                sh "yarn --frozen-lockfile"
                sh "make clean"
                sh "make"
              }
              checkDiffs(['./go/', './protocol/'], 'Please run \\"make\\" inside the client/protocol directory.')
              packagesToTest = getPackagesToTest(dependencyFiles, hasJenkinsfileChanges)
              hasKBFSChanges = packagesToTest.keySet().findIndexOf { key -> key =~ /^github.com\/keybase\/client\/go\/kbfs/ } >= 0
            } else {
              // Ensure that the change target branch has been fetched,
              // since Jenkins only does a sparse checkout by default.
              fetchChangeTarget()
            }
            parallel (
              failFast: true,
              test_xcompilation: { withEnv([
                "PATH=${env.PATH}:${env.GOPATH}/bin",
              ]) {
                if (env.BRANCH_NAME == "master" && cause != "upstream") {
                  // We only cross compile when we're on a master build and we
                  // weren't triggered by upstream. i.e. potentially breaking
                  // changes.
                  dir("go") {
                    def platforms = ["freebsd", "netbsd", "openbsd"]
                    for (platform in platforms) {
                        withEnv(["GOOS=${platform}"]) {
                            println "Testing compilation on ${platform}"
                              sh "go build -tags production -o keybase_${platform} github.com/keybase/client/go/keybase"
                            println "End testing compilation on ${platform}"
                        }
                    }
                  }
                }
              }},
              test_linux_go: { withEnv([
                "PATH=${env.PATH}:${env.GOPATH}/bin",
                "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                "GPG=/usr/bin/gpg.distrib",
              ]) {
                if (hasGoChanges || hasJenkinsfileChanges) {
                  testGo("test_linux_go_", packagesToTest, hasKBFSChanges)
                }
              }},
              test_linux_js: { withEnv([
                "PATH=${env.HOME}/.node/bin:${env.PATH}",
                "NODE_PATH=${env.HOME}/.node/lib/node_modules:${env.NODE_PATH}",
                "NODE_OPTIONS=--max-old-space-size=4096",
              ]) {
                dir("shared") {
                  stage("JS Tests") {
                    sh "git config --global user.name 'Keybase Jenkins'"
                    sh "git config --global user.email 'jenkins@keyba.se'"
                    sh "./jenkins_test.sh js ${env.COMMIT_HASH} ${env.CHANGE_TARGET}"
                  }
                }
              }},
              integrate: {
                // Build the client docker first so we can immediately kick off KBFS
                if ((hasGoChanges && hasKBFSChanges) || hasJenkinsfileChanges) {
                  println "We have KBFS changes, so we are building kbfs-server."
                  dir('go') {
                    sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/keybase"
                    sh "cp ${env.GOPATH}/bin/keybase ./keybase/keybase"
                    docker.build("kbclient")
                    dir('kbfs') {
                      sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsfuse"
                      sh "cp ${env.GOPATH}/bin/kbfsfuse ./kbfsfuse/kbfsfuse"
                      sh "go install -ldflags \"-s -w\" -buildmode=pie github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase"
                      sh "cp ${env.GOPATH}/bin/git-remote-keybase ./kbfsgit/git-remote-keybase/git-remote-keybase"
                      withCredentials([string(credentialsId: 'kbfs-docker-cert-b64-new', variable: 'KBFS_DOCKER_CERT_B64')]) { // TODO update the var in CI
                        def kbfsCert = sh(returnStdout: true, script: "echo Q2VydGlmaWNhdGU6CiAgICBEYXRhOgogICAgICAgIFZlcnNpb246IDMgKDB4MikKICAgICAgICBTZXJpYWwgTnVtYmVyOgogICAgICAgICAgICA3ODo0ZTo2ZjoxYzplMjo3ZTplYTowNzo3OTplMDpmOTozMDoxMTo1NjoyMDoxZjplZjozNTowZTo1ZgogICAgICAgIFNpZ25hdHVyZSBBbGdvcml0aG06IHNoYTI1NldpdGhSU0FFbmNyeXB0aW9uCiAgICAgICAgSXNzdWVyOiBDID0gVVMsIFNUID0gTlksIE8gPSBLZXliYXNlCiAgICAgICAgVmFsaWRpdHkKICAgICAgICAgICAgTm90IEJlZm9yZTogRGVjICA3IDAxOjA4OjQwIDIwMjEgR01UCiAgICAgICAgICAgIE5vdCBBZnRlciA6IERlYyAgNSAwMTowODo0MCAyMDMxIEdNVAogICAgICAgIFN1YmplY3Q6IEMgPSBVUywgU1QgPSBOWSwgTyA9IEtleWJhc2UKICAgICAgICBTdWJqZWN0IFB1YmxpYyBLZXkgSW5mbzoKICAgICAgICAgICAgUHVibGljIEtleSBBbGdvcml0aG06IHJzYUVuY3J5cHRpb24KICAgICAgICAgICAgICAgIFB1YmxpYy1LZXk6ICgyMDQ4IGJpdCkKICAgICAgICAgICAgICAgIE1vZHVsdXM6CiAgICAgICAgICAgICAgICAgICAgMDA6YzE6ZTA6YWU6NjE6YmU6YmY6MmY6NGM6MGE6ZGQ6YmI6YzM6MTQ6MWI6CiAgICAgICAgICAgICAgICAgICAgMWI6MzQ6MTY6NTQ6ZTI6NDY6ZjA6ZWY6MDI6YWM6ZjI6MmE6YTU6YTI6ZmU6CiAgICAgICAgICAgICAgICAgICAgZDM6MGU6YWY6NjU6Y2I6YWQ6N2I6YWY6YTA6Y2I6N2E6NjY6M2Q6ZDI6YjA6CiAgICAgICAgICAgICAgICAgICAgYWQ6NTY6ZTI6YTI6MzE6MTg6Nzc6YTE6NWU6ODI6MzI6Y2E6OWI6NzQ6YjA6CiAgICAgICAgICAgICAgICAgICAgMTQ6ZTg6MTQ6YTg6OTQ6MjY6NmY6NWI6YmE6ZDA6ODA6ZTE6NTY6MmQ6ZjE6CiAgICAgICAgICAgICAgICAgICAgZWE6ZDI6MWE6YTc6YzE6YjE6NDM6Y2U6NjA6MTA6ZDQ6NDE6MjQ6MWE6OTU6CiAgICAgICAgICAgICAgICAgICAgMTY6ZTg6MjA6MWI6Zjk6OTY6NTQ6NDI6OTI6N2U6ZjE6ODQ6ZTU6NzQ6MjU6CiAgICAgICAgICAgICAgICAgICAgZDc6NzA6Nzk6Zjk6NzI6ZWY6NDU6ZDU6YzY6Mjk6OTM6MDE6NmM6NTg6MGY6CiAgICAgICAgICAgICAgICAgICAgMzU6ZDI6ZGU6MTI6NGI6NTc6N2U6MmM6MjQ6MzE6OTM6NTc6MDU6ZTE6MDg6CiAgICAgICAgICAgICAgICAgICAgYzk6YWU6Yjk6ZGM6YjU6MzA6NTI6YTU6NWI6Nzc6NmM6Mzk6YjQ6ZjU6YmM6CiAgICAgICAgICAgICAgICAgICAgY2Q6NmY6M2Y6NDc6Yjk6YzQ6M2U6NjE6YzA6ZjY6N2I6OTY6NzE6ZTg6OTg6CiAgICAgICAgICAgICAgICAgICAgNTg6MDQ6NDA6MWE6ZjY6MjE6MWQ6N2U6NGE6NjE6ZGU6NDE6OGI6NjQ6NGY6CiAgICAgICAgICAgICAgICAgICAgOTE6MzI6Y2M6MjE6OGI6OTQ6NjA6ZTk6ZWE6ZTQ6N2M6NjE6ODQ6MzU6YmY6CiAgICAgICAgICAgICAgICAgICAgZWM6NGQ6NTU6NDk6NTk6MmM6NzE6MTA6NmQ6MTc6OTQ6NjQ6N2Q6YzA6MGY6CiAgICAgICAgICAgICAgICAgICAgNzA6NTQ6MGY6YTc6Zjg6YzM6OWQ6MTk6ZTY6MDc6YTk6MWY6M2Y6NWY6YTM6CiAgICAgICAgICAgICAgICAgICAgYmU6YzQ6ZWY6YTE6MmE6MWI6NmU6YmU6MTM6MDk6YjY6M2E6MDE6YjU6Mzk6CiAgICAgICAgICAgICAgICAgICAgN2U6OWE6NGM6MTM6OGQ6OTI6Y2Y6NDM6MDM6MmM6YjU6ODU6NTM6Mjk6Njg6CiAgICAgICAgICAgICAgICAgICAgMmQ6YWQKICAgICAgICAgICAgICAgIEV4cG9uZW50OiA2NTUzNyAoMHgxMDAwMSkKICAgICAgICBYNTA5djMgZXh0ZW5zaW9uczoKICAgICAgICAgICAgWDUwOXYzIFN1YmplY3QgS2V5IElkZW50aWZpZXI6IAogICAgICAgICAgICAgICAgMzQ6Qjg6NTU6MjQ6OUE6QUY6MDI6QTU6RTM6RDM6RTI6MzY6Mjg6NzE6MDc6REQ6N0Q6QzM6NTI6QzUKICAgICAgICAgICAgWDUwOXYzIEF1dGhvcml0eSBLZXkgSWRlbnRpZmllcjogCiAgICAgICAgICAgICAgICAzNDpCODo1NToyNDo5QTpBRjowMjpBNTpFMzpEMzpFMjozNjoyODo3MTowNzpERDo3RDpDMzo1MjpDNQogICAgICAgICAgICBYNTA5djMgQmFzaWMgQ29uc3RyYWludHM6IAogICAgICAgICAgICAgICAgQ0E6VFJVRQogICAgICAgICAgICBYNTA5djMgU3ViamVjdCBBbHRlcm5hdGl2ZSBOYW1lOiAKICAgICAgICAgICAgICAgIElQIEFkZHJlc3M6MTI3LjAuMC4xLCBETlM6ZGV2LmtleWJhc2UuaW8sIEROUzpsb2NhbGhvc3QKICAgIFNpZ25hdHVyZSBBbGdvcml0aG06IHNoYTI1NldpdGhSU0FFbmNyeXB0aW9uCiAgICBTaWduYXR1cmUgVmFsdWU6CiAgICAgICAgNjM6NDg6YjE6ZDk6MWM6NmE6ZDg6MjI6Y2E6N2Q6YzE6ZDU6ZDA6NWU6NGE6ODA6Nzg6Yjg6CiAgICAgICAgNzI6MTE6Y2U6YTI6OWU6MWY6NTg6ZTA6M2U6ZDk6Mjc6ZWY6ZTY6YTA6MGM6N2M6NzU6YmI6CiAgICAgICAgYmM6NDA6NzE6MzE6ZjU6NDQ6NDY6NjY6OTI6YTE6ZDY6OTQ6YzU6NGY6ZTM6ZjU6Mjg6OGE6CiAgICAgICAgMGE6N2U6M2M6ZjY6MDI6OWU6ZWI6YTY6MDk6ODk6YTU6MmE6NTY6Mzk6MzE6OGI6YjY6MDU6CiAgICAgICAgMTM6YmY6NWE6NjM6ZDU6NmE6Yjg6NGQ6MDc6MDg6YjY6YTc6ZTY6MTU6ODE6Yzg6ZTk6NmE6CiAgICAgICAgNzI6NGU6ZTM6NmE6MWU6Mzg6MDc6NjU6YjA6NTg6MmI6YTE6YmM6Y2E6ODE6NWM6YzY6Y2Y6CiAgICAgICAgNWM6OGQ6NGY6NDc6NDc6OGM6N2E6ZjQ6OTc6M2I6MjY6ZmE6MDk6NTk6M2E6OWM6ZDU6Yzg6CiAgICAgICAgY2Q6Y2Q6YWM6NzQ6Yjc6OWU6MTA6M2U6MzQ6NzQ6OGQ6OGE6ZDk6YWY6NTA6YTQ6YjM6ODg6CiAgICAgICAgYjQ6ZTM6ODE6NzM6MDg6YjU6OWI6NDc6N2M6MjA6ZTI6NzY6MmE6ZmI6MGE6NTE6Nzk6NTk6CiAgICAgICAgMWM6NmM6NDE6ODI6OTc6MjU6NjY6Mjk6NTQ6MmU6OWY6NGE6YTg6OTg6Njg6NmE6Y2I6OWI6CiAgICAgICAgNDk6MWY6NzA6MzI6YTg6ZTY6MmY6MjM6ZGU6OTg6NDM6MmQ6MjM6MjA6NTU6M2U6MWI6OWQ6CiAgICAgICAgOTE6ZTk6MGQ6ZTY6ODA6Mzk6ODQ6ZjQ6Yzg6MDk6NWE6YTE6YmQ6YzQ6NTY6OTk6MmY6N2U6CiAgICAgICAgOTE6ZDA6NmU6MzA6MTc6Nzg6ZmY6MWY6OTg6Njg6ZmE6ZDA6YjY6NTU6ZmM6YTM6ZWU6Mjg6CiAgICAgICAgYTk6Yjg6Mzg6ZjY6YWI6ZWY6NTU6NDE6YzY6YzU6OGM6NjU6ODA6MGY6ZjU6YmQ6MTA6ZWQ6CiAgICAgICAgOGI6MzM6N2U6MWMKLS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURZakNDQWtxZ0F3SUJBZ0lVZUU1dkhPSis2Z2Q1NFBrd0VWWWdIKzgxRGw4d0RRWUpLb1pJaHZjTkFRRUwKQlFBd0xERUxNQWtHQTFVRUJoTUNWVk14Q3pBSkJnTlZCQWdNQWs1Wk1SQXdEZ1lEVlFRS0RBZExaWGxpWVhObApNQjRYRFRJeE1USXdOekF4TURnME1Gb1hEVE14TVRJd05UQXhNRGcwTUZvd0xERUxNQWtHQTFVRUJoTUNWVk14CkN6QUpCZ05WQkFnTUFrNVpNUkF3RGdZRFZRUUtEQWRMWlhsaVlYTmxNSUlCSWpBTkJna3Foa2lHOXcwQkFRRUYKQUFPQ0FROEFNSUlCQ2dLQ0FRRUF3ZUN1WWI2L0wwd0szYnZERkJzYk5CWlU0a2J3N3dLczhpcWxvdjdURHE5bAp5NjE3cjZETGVtWTkwckN0VnVLaU1SaDNvVjZDTXNxYmRMQVU2QlNvbENadlc3clFnT0ZXTGZIcTBocW53YkZECnptQVExRUVrR3BVVzZDQWIrWlpVUXBKKzhZVGxkQ1hYY0huNWN1OUYxY1lwa3dGc1dBODEwdDRTUzFkK0xDUXgKazFjRjRRakpycm5jdFRCU3BWdDNiRG0wOWJ6TmJ6OUh1Y1ErWWNEMmU1Wng2SmhZQkVBYTlpRWRma3BoM2tHTApaRStSTXN3aGk1Umc2ZXJrZkdHRU5iL3NUVlZKV1N4eEVHMFhsR1I5d0E5d1ZBK24rTU9kR2VZSHFSOC9YNk8rCnhPK2hLaHR1dmhNSnRqb0J0VGwrbWt3VGpaTFBRd01zdFlWVEtXZ3RyUUlEQVFBQm8zd3dlakFkQmdOVkhRNEUKRmdRVU5MaFZKSnF2QXFYajArSTJLSEVIM1gzRFVzVXdId1lEVlIwakJCZ3dGb0FVTkxoVkpKcXZBcVhqMCtJMgpLSEVIM1gzRFVzVXdEQVlEVlIwVEJBVXdBd0VCL3pBcUJnTlZIUkVFSXpBaGh3Ui9BQUFCZ2c1a1pYWXVhMlY1ClltRnpaUzVwYjRJSmJHOWpZV3hvYjNOME1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQmpTTEhaSEdyWUlzcDkKd2RYUVhrcUFlTGh5RWM2aW5oOVk0RDdaSisvbW9BeDhkYnU4UUhFeDlVUkdacEtoMXBURlQrUDFLSW9LZmp6MgpBcDdycGdtSnBTcFdPVEdMdGdVVHYxcGoxV3E0VFFjSXRxZm1GWUhJNldweVR1TnFIamdIWmJCWUs2Rzh5b0ZjCnhzOWNqVTlIUjR4NjlKYzdKdm9KV1RxYzFjak56YXgwdDU0UVBqUjBqWXJacjFDa3M0aTA0NEZ6Q0xXYlIzd2cKNG5ZcSt3cFJlVmtjYkVHQ2x5Vm1LVlF1bjBxb21HaHF5NXRKSDNBeXFPWXZJOTZZUXkwaklGVStHNTJSNlEzbQpnRG1FOU1nSldxRzl4RmFaTDM2UjBHNHdGM2ovSDVobyt0QzJWZnlqN2lpcHVEajJxKzlWUWNiRmpHV0FEL1c5CkVPMkxNMzRjCi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K | sed 's/ //g' | base64 -d")
                        kbfsfuseImage = docker.build('897413463132.dkr.ecr.us-east-1.amazonaws.com/client', "--build-arg KEYBASE_TEST_ROOT_CERT_PEM=\"$kbfsCert\" .")
                      }
                      docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
                        kbfsfuseImage.push(env.BUILD_TAG)
                      }
                      if (env.BRANCH_NAME == "master" && cause != "upstream") {
                        build([
                          job: "/kbfs-server/master",
                          parameters: [
                            string(
                              name: 'kbfsProjectName',
                              value: env.BUILD_TAG,
                            ),
                            string(
                              name: 'kbwebProjectName',
                              value: kbwebTag,
                            ),
                          ]
                        ])
                      }
                    }
                  }
                }
              },
            )
          },
          test_windows: {
            if (hasGoChanges || hasJenkinsfileChanges) {
              helpers.nodeWithCleanup('windows-ssh', {}, {}) {
                def BASEDIR="${pwd()}"
                def GOPATH="${BASEDIR}\\go"
                withEnv([
                  'GOROOT=C:\\Program Files\\go',
                  "GOPATH=\"${GOPATH}\"",
                  "PATH=\"C:\\tools\\go\\bin\";\"C:\\Program Files (x86)\\GNU\\GnuPG\";\"C:\\Program Files\\nodejs\";\"C:\\tools\\python\";\"C:\\Program Files\\graphicsmagick-1.3.24-q8\";\"${GOPATH}\\bin\";${env.PATH}",
                  "KEYBASE_SERVER_URI=http://${kbwebNodePrivateIP}:3000",
                  "KEYBASE_PUSH_SERVER_URI=fmprpc://${kbwebNodePrivateIP}:9911",
                  "TMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                  "TEMP=C:\\Users\\Administrator\\AppData\\Local\\Temp",
                ]) {
                ws("client") {
                  println "Checkout Windows"
                  retry(3) {
                    checkout scm
                  }

                  println "Test Windows"
                  parallel (
                    test_windows_go: {
                      testGo("test_windows_go_", getPackagesToTest(dependencyFiles, hasJenkinsfileChanges), hasKBFSChanges)
                    }
                  )
                }}
              }
            }
          },
        )
      }
    }

    stage("Push") {
      //if (env.BRANCH_NAME == "master" && cause != "upstream") {
        docker.withRegistry('https://897413463132.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-ecr-user') {
          kbfsfuseImage.push('master')
        }
      //} else {
      //  println "Not pushing docker"
      //}
    }
  }
}

def getTestDirsNix() {
  def dirs = sh(
    returnStdout: true,
    script: "go list ./... | grep -v 'bind'"
  ).trim()
  println "Running tests for dirs: " + dirs
  return dirs.tokenize()
}

def getTestDirsWindows() {
  def dirs = bat(returnStdout: true, script: "@go list ./... | find /V \"/go/bind\"").trim()
  println "Running tests for dirs: " + dirs
  return dirs.tokenize()
}

def fetchChangeTarget() {
  if (env.CHANGE_TARGET) {
    // Load list of packages that changed.
    sh "git config --add remote.origin.fetch +refs/heads/*:refs/remotes/origin/* # timeout=10"
    sh "git fetch origin ${env.CHANGE_TARGET}"
  }
}

def getBaseCommitHash() {
    return sh(returnStdout: true, script: "git rev-parse origin/${env.CHANGE_TARGET}").trim()
}

def getDiffFileList() {
    def BASE_COMMIT_HASH = getBaseCommitHash()
    return sh(returnStdout: true, script: "bash -c \"set -o pipefail; git merge-tree \$(git merge-base ${BASE_COMMIT_HASH} HEAD) ${BASE_COMMIT_HASH} HEAD | grep '[0-9]\\+\\s[0-9a-f]\\{40\\}' | awk '{print \\\$4}'\"").trim()
}

def getDiffGoDependencies() {
    def BASE_COMMIT_HASH = getBaseCommitHash()
    return sh(returnStdout: true,
    script: """
      # only output the new and modified dependencies using version to compare
      diff --unchanged-line-format= --old-line-format= --new-line-format='%L' <(
          base_dir="\$(mktemp -d)" &&
          # get the go.mod & go.sum from the base commit OR fail if they don't exist
          git show ${BASE_COMMIT_HASH}:go/go.mod > "\$base_dir/go.mod" &&
          git show ${BASE_COMMIT_HASH}:go/go.sum > "\$base_dir/go.sum" &&
          cd "\$base_dir" &&
          # ignoring the current module github.com/keybase/client/go (where .Main=true) and list all dependencies and their versions
          # if the dependency is forked (or replaced), print out forked version instead
          go list -f '{{if not .Main}}{{ .Path }} {{if .Replace}}{{ .Replace.Version }}{{else}}{{ .Version }}{{end}}{{end}}' -m all | sort
        ) <(
          cd go &&
          # ignoring the current module github.com/keybase/client/go (where .Main=true) and list all dependencies and their versions
          # if the dependency is forked (or replaced), print out forked version instead
          go list -f '{{if not .Main}}{{ .Path }} {{if .Replace}}{{ .Replace.Version }}{{else}}{{ .Version }}{{end}}{{end}}' -m all | sort
        ) | cut -d' ' -f1 # trim the version number leaving just the module
    """).trim().split()
}

def getPackagesToTest(dependencyFiles, hasJenkinsfileChanges) {
  def packagesToTest = [:]
  dir('go') {
    // The below has produce a garden variety of errors. Maybe we can re-enable
    // it. At some point.
    // if (env.CHANGE_TARGET && !hasJenkinsfileChanges) {
    //  // The Jenkinsfile hasn't changed, so we try to run a minimal set of
    //  // tests to capture the changes in this PR.
    //  fetchChangeTarget()
    //  def diffFileList = getDiffFileList()
    //  def diffPackageList = sh(returnStdout: true, script: "bash -c \"set -o pipefail; echo '${diffFileList}' | grep '^go\\/' | sed 's/^\\(.*\\)\\/[^\\/]*\$/github.com\\/keybase\\/client\\/\\1/' | sort | uniq\"").trim().split()
    //  def diffPackagesAsString = diffPackageList.join(' ')
    //  println "Go packages changed:\n${diffPackagesAsString}"
    //  def diffDependencies = getDiffGoDependencies()
    //  def diffDependenciesAsString = diffDependencies.join(' ')
    //  println "Go dependencies changed:\n${diffDependenciesAsString}"

    //  // Load list of dependencies and mark all dependent packages to test.
    //  def goos = sh(returnStdout: true, script: "go env GOOS").trim()
    //  def dependencyMap = new JsonSlurperClassic().parseText(dependencyFiles[goos])
    //  diffPackageList.each { pkg ->
    //    // pkg changed; we need to load it from dependencyMap to see
    //    // which tests should be run.
    //    dependencyMap[pkg].each { dep, _ ->
    //      packagesToTest[dep] = 1
    //    }
    //  }
    //  diffDependencies.each { pkg ->
    //    // dependency changed; we need to load it from dependencyMap to see
    //    // which tests should be run.
    //    dependencyMap[pkg].each { dep, _ ->
    //      packagesToTest[dep] = 1
    //    }
    //  }
    //  return packagesToTest
    //}
    //println "This is a branch build or the Jenkinsfile has changed, so we are running all tests."
    diffPackageList = sh(returnStdout: true, script: 'go list ./...').trim().split()
    // If we get here, just run all the tests in `diffPackageList`
    diffPackageList.each { pkg ->
      if (pkg != 'github.com/keybase/client/go/bind') {
        packagesToTest[pkg] = 1
      }
    }
  }
  return packagesToTest
}

def testGo(prefix, packagesToTest, hasKBFSChanges) {
  dir('go') {
  withEnv([
    "KEYBASE_LOG_SETUPTEST_FUNCS=1",
    "KEYBASE_RUN_CI=1",
  ].plus(isUnix() ? [] : [
    'CC=C:\\cygwin64\\bin\\x86_64-w64-mingw32-gcc.exe',
    'CPATH=C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include;C:\\cygwin64\\usr\\x86_64-w64-mingw32\\sys-root\\mingw\\include\\ddk',
  ])) {
  parallel (
    test_go_builds: {
      testGoBuilds(prefix, packagesToTest, hasKBFSChanges)
    },
    test_go_test_suite: {
      testGoTestSuite(prefix, packagesToTest)
    },
    failFast: true
  )
  }}
}

def testGoBuilds(prefix, packagesToTest, hasKBFSChanges) {
  if (prefix == "test_linux_go_") {
    dir("keybase") {
      sh "go build -o keybase_production -ldflags \"-s -w\" -buildmode=pie --tags=production"
    }
    dir("fuzz") {
      sh "go build -tags gofuzz ./..."
    }
  } else if (prefix == "test_windows_go_") {
    dir("keybase") {
      sh "go build -o keybase_production -ldflags \"-s -w\" --tags=production"
    }
  }

  println "Running golint"
  dir("buildtools") {
    retry(5) {
      sh 'go install golang.org/x/lint/golint'
    }
  }
  retry(5) {
    timeout(activity: true, time: 300, unit: 'SECONDS') {
      sh 'make -s lint'
    }
  }

  if (prefix == "test_linux_go_") {
    // Only test golangci-lint on linux
    println "Installing golangci-lint"
    dir("buildtools") {
      retry(5) {
        sh 'go install github.com/golangci/golangci-lint/cmd/golangci-lint'
      }
    }

    // TODO re-enable for kbfs.
    // if (hasKBFSChanges) {
    //   println "Running golangci-lint on KBFS"
    //   dir('kbfs') {
    //     retry(5) {
    //       timeout(activity: true, time: 720, unit: 'SECONDS') {
    //         // Ignore the `dokan` directory since it contains lots of c code.
    //         sh 'go list -f "{{.Dir}}" ./...  | fgrep -v dokan  | xargs realpath --relative-to=. | xargs golangci-lint run --deadline 10m0s'
    //       }
    //     }
    //   }
    // }

    if (env.CHANGE_TARGET) {
      println("Running golangci-lint on new code")
      fetchChangeTarget()
      def BASE_COMMIT_HASH = getBaseCommitHash()
      timeout(activity: true, time: 720, unit: 'SECONDS') {
        // Ignore the `protocol` directory, autogeneration has some critques
        sh "go list -f '{{.Dir}}' ./...  | fgrep -v kbfs | fgrep -v protocol | xargs realpath --relative-to=. | xargs golangci-lint run --new-from-rev ${BASE_COMMIT_HASH} --deadline 10m0s"
      }
    } else {
      println("Running golangci-lint on all non-KBFS code")
      timeout(activity: true, time: 720, unit: 'SECONDS') {
        sh "make golangci-lint-nonkbfs"
      }
    }

    // Windows `gofmt` pukes on CRLF.
    // Macos pukes on mockgen because ¯\_(ツ)_/¯.
    // So, only run on Linux.
    println "Running mockgen"
    dir("buildtools") {
      retry(5) {
        sh 'go install github.com/golang/mock/mockgen'
      }
    }
    dir('kbfs/data') {
      retry(5) {
        timeout(activity: true, time: 90, unit: 'SECONDS') {
          sh '''
            set -e -x
            ./gen_mocks.sh
            git diff --exit-code
          '''
        }
      }
    }
    dir('kbfs/libkbfs') {
      retry(5) {
        timeout(activity: true, time: 90, unit: 'SECONDS') {
          sh '''
            set -e -x
            ./gen_mocks.sh
            git diff --exit-code
          '''
        }
      }
    }
  }
}

def testGoTestSuite(prefix, packagesToTest) {
  def dirs = getTestDirsNix()
  def goversion = sh(returnStdout: true, script: "go version").trim()
  println "Testing Go code on commit ${env.COMMIT_HASH} with ${goversion}. Merging to branch ${env.CHANGE_TARGET}."

  // Make sure we don't accidentally pull in the testing package.
  sh '! go list -f \'{{ join .Deps "\\n" }}\' github.com/keybase/client/go/keybase | grep testing'

  println "Building citogo"
  sh '(cd citogo && go install)'

  def packageTestSet = packagesToTest.keySet()
  println "Go packages to test:\n${packageTestSet.join('\n')}"

  def tests = [:]
  def testSpecMap = [
    test_linux_go_: [
      '*': [],
      'github.com/keybase/client/go/chat': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/chat/attachments': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/test': [
        name: 'kbfs_test_fuse',
        flags: '-tags fuse',
        timeout: '15m',
      ],
      'github.com/keybase/client/go/kbfs/data': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libfuse': [
        // TODO re-enable
        // flags: '',
        // timeout: '5m',
        // citogo_extra : '--pause 1s',
        // no_citogo : '1'
        disable: true,
      ],
      'github.com/keybase/client/go/kbfs/idutil': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsblock': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfscodec': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfscrypto': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsedits': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsgit': [
        flags: '-race',
        timeout: '10m',
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/kbfsgit/git-remote-keybase': [
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/fsrpc': [
        compileAlone: true,
      ],
      'github.com/keybase/client/go/kbfs/kbfshash': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfsmd': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbfssync': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/kbpagesconfig': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/ldbutils': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libcontext': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libfs': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libgit': [
        flags: '-race',
        timeout: '10m',
      ],
      'github.com/keybase/client/go/kbfs/libhttpserver': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libkey': [
        flags: '-race',
        timeout: '5m',
      ],
      'github.com/keybase/client/go/kbfs/libkbfs': [
        flags: '-race',
        timeout: '5m',
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/libpages': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/libpages/config': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/search': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/simplefs': [
        flags: '-race',
        timeout: '2m',
      ],
      'github.com/keybase/client/go/kbfs/test': [
        name: 'kbfs_test_race',
        flags: '-race',
        timeout: '12m',
      ],
      'github.com/keybase/client/go/kbfs/tlf': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/tlfhandle': [
        flags: '-race',
        timeout: '30s',
      ],
      'github.com/keybase/client/go/kbfs/dokan': [
        disable: true,
      ],
      'github.com/keybase/client/go/teams': [
        parallel: 1,
      ],
    ],
    test_windows_go_: [
      '*': [],
      'github.com/keybase/client/go/systests': [
        disable: true,
      ],
      'github.com/keybase/client/go/chat': [
        disable: true,
      ],
      'github.com/keybase/client/go/teams': [
        disable: true,
      ],
      'github.com/keybase/client/go/kbfs/libdokan': [
        parallel: 1,
      ],
      'github.com/keybase/client/go/kbfs/dokan': [
        compileAlone: true,
      ],
    ],
  ]
  def getOverallTimeout = { testSpec ->
    def timeoutMatches = (testSpec.timeout =~ /(\d+)([ms])/)
    return [
      time: 1 + (timeoutMatches[0][1] as Integer),
      unit: timeoutMatches[0][2] == 's' ? 'SECONDS' : 'MINUTES',
    ]
  }
  def defaultPackageTestSpec = { pkg ->
    def dirPath = pkg.replaceAll('github.com/keybase/client/go/', '')
    def testName = dirPath.replaceAll('/', '_')
    return [
      name: testName,
      flags: '',
      timeout: '30m',
      dirPath: dirPath,
      parallel: 4,
      pkg: pkg,
    ]
  }
  def getPackageTestSpec = { pkg ->
    if (testSpecMap[prefix].containsKey(pkg)) {
      if (testSpecMap[prefix][pkg]) {
        def testSpec = testSpecMap[prefix][pkg]
        if (testSpec['disable']) {
          return false
        }
        return defaultPackageTestSpec(pkg) + testSpec
      }
      return defaultPackageTestSpec(pkg)
    }
    if (testSpecMap[prefix].containsKey('*')) {
      return defaultPackageTestSpec(pkg)
    }
    return false
  }

  println "Compiling ${packageTestSet.size()} test(s)"
  def packageTestCompileList = []
  def packageTestRunList = []
  packagesToTest.each { pkg, _ ->
    def testSpec = getPackageTestSpec(pkg)
    if (testSpec && !testSpec.disable) {
      testSpec.testBinary = "${testSpec.name}.test"
      packageTestCompileList.add([
        closure: {
          sh "go test -vet=off -c ${testSpec.flags} -o ${testSpec.dirPath}/${testSpec.testBinary} ./${testSpec.dirPath}"
        },
        alone: !!testSpec.compileAlone,
      ])
      packageTestRunList.add([
        closure: { spec ->
          dir(spec.dirPath) {
            // Only run the test if a test binary should have been produced.
            if (fileExists(spec.testBinary)) {
              println "Running tests for ${spec.dirPath}"
              def t = getOverallTimeout(spec)
              timeout(activity: true, time: t.time, unit: t.unit) {
                if (spec.no_citogo) {
                  sh "./${spec.testBinary} -test.timeout ${spec.timeout}"
                } else {
                  sh "citogo --flakes 3 --fails 3 --build-id ${env.BUILD_ID} --branch ${env.BRANCH_NAME} --prefix ${spec.dirPath} --s3bucket ci-fail-logs --report-lambda-function report-citogo --build-url ${env.BUILD_URL} --no-compile --test-binary ./${spec.testBinary} --timeout 150s -parallel=${spec.parallel} ${spec.citogo_extra ? spec.citogo_extra : ''}"
                }
              }
            }
          }
        }.curry(testSpec),
        alone: !!testSpec.runAlone,
      ])
    }
  }
  executeInWorkers(3, true /* runFirstItemAlone */, packageTestCompileList)

  helpers.waitForURLWithTimeout(prefix, env.KEYBASE_SERVER_URI, 600)
  println "Running ${packageTestSet.size()} test(s)"
  withCredentials([
    string(credentialsId: 'citogo-flake-webhook', variable : 'CITOGO_FLAKE_WEBHOOK'),
    string(credentialsId: 'citogo-aws-secret-access-key', variable : 'CITOGO_AWS_SECRET_ACCESS_KEY'),
    string(credentialsId: 'citogo-aws-access-key-id', variable : 'CITOGO_AWS_ACCESS_KEY_ID'),
    string(credentialsId: 'citogo-master-fail-webhook', variable : 'CITOGO_MASTER_FAIL_WEBHOOK'),
  ]) {
    executeInWorkers(4, false /* runFirstItemAlone */, packageTestRunList)
  }
}

def executeInWorkers(numWorkers, runFirstItemAlone, queue) {
  def workers = [:]
  def i = 0
  for (n = 1; n <= numWorkers; n++) {
    workers["worker_${n}"] = {
      def done = false
      for (; !done;) {
        def item
        def alone

        // Concurrency hack
        def lockID = "${env.BUILD_TAG}"
        lock(lockID) {
          if (i < queue.size()) {
            item = queue.getAt(i)
            // Run first item on its own if requested
            alone = item.alone || (runFirstItemAlone && i == 0)
            if (alone) {
              item.closure()
            }
            i++
          } else {
            done = true
          }
        }
        if (done) {
          break
        }
        if (!alone) {
          item.closure()
        }
      }
    }
  }
  workers.failFast = true
  parallel(workers)
}

def checkDiffs(dirs, addressMessage) {
  def joinedDirs = dirs.join(" ")
  try {
    sh "git diff --patience --exit-code HEAD -- ${joinedDirs}"
  } catch (ex) {
    sh """
        bash -c 'echo "ERROR: \\"git diff\\" detected changes. Some files in the directories {${dirs.join(", ")}} are stale. ${addressMessage}" && (exit 1)'
    """
  }
}
