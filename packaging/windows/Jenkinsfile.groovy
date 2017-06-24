helpers = fileLoader.fromGit('helpers', 'https://github.com/keybase/jenkins-helpers.git', 'master', null, 'linux')

def getCommit(path) {
    dir(path) {
        return bat(returnStdout: true, script: '@echo off && git rev-parse HEAD').trim()
    }
}

def checkout_keybase(repo, revision) {
    dir("src/github.com/keybase/${repo}") {
        retry(3) {
            checkout([
                scm: [
                    $class: 'GitSCM',
                    branches: [[name: revision]],
                    userRemoteConfigs: [[url: "https://github.com/keybase/${repo}.git"]],
                ]
            ])
        }
    }
}

def publish(bucket, excluded, source) {
    step([
        $class: 'S3BucketPublisher',
        dontWaitForConcurrentBuildCompletion: false,
        entries: [[
            bucket: bucket,
            excludedFile: excluded,
            flatten: true,
            noUploadOnFailure: true,
            selectedRegion: 'us-east-1',
            sourceFile: source,
            storageClass: 'STANDARD',
            uploadFromSlave: true,
        ]],
        profileName: 'keybase',
        userMetadata: []
    ])

}

def doBuild() {
    stage('Checkout Client') {
        // Reset symlink due to node/git/windows problems
        retry(3) {
            bat 'if EXIST src\\github.com\\keybase\\client\\shared cd src\\github.com\\keybase\\client && git checkout shared'
            bat 'if EXIST src\\github.com\\keybase\\client\\desktop\\shared cd src\\github.com\\keybase\\client && git checkout desktop/shared'
            bat 'if EXIST src\\github.com\\keybase\\client\\desktop\\renderer\\fonts cd src\\github.com\\keybase\\client && git checkout desktop/renderer/fonts'
        }
        parallel(
            checkout_client: { checkout_keybase('client', ClientRevision) },
            checkout_kbfs: { checkout_keybase('kbfs', KBFSRevision) },
            checkout_updater: { checkout_keybase('go-updater', UpdaterRevision) },
            checkout_release: { checkout_keybase('release', ReleaseRevision) },
        )
    }
    // Make sure any previous desktop build is deleted
    bat '''
        if EXIST src\\github.com\\keybase\\client\\shared\\desktop\\release rmdir /q /s src\\github.com\\keybase\\client\\shared\\desktop\\release
        path
    '''
    stage('Wait for CI') {
        if (UpdateChannel == "SmokeCI"){
            def clientCommit = getCommit('src\\github.com\\keybase\\client')
            def kbfsCommit =  getCommit('src\\github.com\\keybase\\kbfs')
            withCredentials([[
                $class: 'StringBinding',
                credentialsId: 'GITHUB_TOKEN',
                variable: 'GITHUB_TOKEN'
                ]]) {
                dir('src\\github.com\\keybase\\release') {
                    bat 'go build'
                    bat "release wait-ci --repo=\"client\" --commit=\"${clientCommit}\" --context=\"continuous-integration/jenkins/branch\" --context=\"ci/circleci\""
                    bat "release wait-ci --repo=\"kbfs\" --commit=\"${kbfsCommit}\" --context=\"continuous-integration/jenkins/branch\" --context=\"ci/circleci\""
                }
            }
        } else {
            echo "Non CI build"
        }
    }                
    stage('Build Client') {
        bat '"%ProgramFiles(x86)%\\Microsoft Visual Studio 14.0\\vc\\bin\\vcvars32.bat" && src\\github.com\\keybase\\client\\packaging\\windows\\build_prerelease.cmd'
    }

    stage('RunQuiet Utility') {
        dir('src\\github.com\\keybase\\client\\go\\tools\\runquiet') {
            def oldHash = new URL('https://s3.amazonaws.com/prerelease.keybase.io/windows-support/runquiet/runquiet.hash').getText()
            def currentHash = bat(returnStdout: true, script: '@echo off && git log -1 -- runquiet.go')
            if (oldHash == currentHash){
                echo "downloading keybaserq"
                withAWS(region:'us-east-1', credentials:'amazon_s3_user_pw') {
                    s3Download(file:'keybaserq.exe', bucket:'prerelease.keybase.io', path:'windows-support/runquiet/keybaserq.exe', force:true)
                }
            } else {
                echo "--- runquiet hashes differ, building keybaserq. Server hash: ---"
                echo oldHash
                echo "--- Current hash: ---"
                echo currentHash
                bat '..\\..\\..\\packaging\\windows\\buildrq.bat'
            }
        }
    }

    stage('Build UI') {
        withEnv(["PATH=${env.PATH};C:\\Program Files (x86)\\yarn\\bin"]) {
            bat 'path'
            bat 'src\\github.com\\keybase\\client\\packaging\\windows\\buildui.bat'
        }
    }
    stage('Build Installer') {
        bat 'call "%ProgramFiles(x86)%\\Microsoft Visual Studio 14.0\\vc\\bin\\vcvars32.bat" && src\\github.com\\keybase\\client\\packaging\\windows\\doinstaller_wix.cmd'
        archiveArtifacts "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\*.*"
    }

    stage('Publish to S3') {
        if (UpdateChannel != "None"){    
            publish("prerelease.keybase.io/windows", 
                    "", 
                    "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\*.exe") 
            // Test channel json
            publish("prerelease.keybase.io", 
                    "", 
                    "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\update-windows-prod-test-v2.json") 
        } else {
            echo "No update channel"
        }
    }

    
    stage('Invoke SmokeB build') {
        if (UpdateChannel == "Smoke" || UpdateChannel == "SmokeCI"){
            // Smoke A json
            publish("prerelease.keybase.io/windows-support", 
                "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\update-windows-prod-test-v2.json",
                "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\*.json") 

            def clientCommit = getCommit('src\\github.com\\keybase\\client')
            def kbfsCommit =  getCommit('src\\github.com\\keybase\\kbfs')
            def updaterCommit =  getCommit('src\\github.com\\keybase\\go-updater')
            def releaseCommit =  getCommit('src\\github.com\\keybase\\release')
            def smokeASemVer = ''
            dir('src\\github.com\\keybase\\client\\go\\keybase') {
                // Capture keybase's semantic version
                smokeASemVer = bat(returnStdout: true, script: '@echo off && for /f "tokens=3" %%i in (\'keybase -version\') do echo %%i').trim()
            }
            build([
                job: "${env.JOB_NAME}",
                parameters: [
                    string(name: 'ClientRevision', value: "${clientCommit}"),
                    string(name: 'KBFSRevision', value: "${kbfsCommit}"),
                    string(name: 'UpdaterRevision', value: "${updaterCommit}"),
                    string(name: 'ReleaseRevision', value: "${releaseCommit}"),
                    string(name: 'DOKAN_PATH', value: "${DOKAN_PATH}"),
                    string(name: 'UpdateChannel', value: 'Smoke2'),
                    string(name: 'SmokeASemVer', value: "${smokeASemVer}")
                    boolean(name: 'SlackBuild', value: "${SlackBuild}")
                ],
                wait: false
            ])
        } else {
            echo "Not a Smoke build"
        }
    }
    stage('Publish smoke updater jsons to S3') {
        if (UpdateChannel == "Smoke2") {
            // Smoke B json
            publish("prerelease.keybase.io/windows-support", 
                "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\update-windows-prod-test-v2.json",
                "src\\github.com\\keybase\\client\\packaging\\windows\\${BUILD_TAG}\\*.json") 
            def smokeBSemVer = ''
            dir('src\\github.com\\keybase\\client\\go\\keybase') {
                // Capture keybase's semantic version
                smokeBSemVer = bat(returnStdout: true, script: '@echo off && for /f "tokens=3" %%i in (\'keybase -version\') do echo %%i').trim()
            }
            echo "SmokeASemVer: ${params.SmokeASemVer}"
            withCredentials([[
                $class: 'StringBinding',
                credentialsId: 'KEYBASE_TOKEN',
                variable: 'KEYBASE_TOKEN'
                ]]) {
                dir('src\\github.com\\keybase\\release') {
                    bat "release announce-build --build-a=\"${params.SmokeASemVer}\" --build-b=\"${smokeBSemVer}\" --platform=\"windows\""
                }
            }
        } else {
            echo "Non Smoke2 build"
        }
    }
}

def notifySlack(String buildStatus = 'STARTED') {
    if(SlackBuild) {
        // Build status of null means success.
        buildStatus = buildStatus ?: 'SUCCESS'

        def color

        if (buildStatus == 'STARTED') {
            color = '#D4DADF'
        } else if (buildStatus == 'SUCCESS') {
            color = '#BDFFC3'
        } else if (buildStatus == 'UNSTABLE') {
            color = '#FFFE89'
        } else {
            color = '#FF9FA1'
        }

        def msg = "${buildStatus}: `${env.JOB_NAME}` #${env.BUILD_NUMBER}:\n${env.BUILD_URL}"

        helpers.slackMessage("bot-test2", color, msg)
    }
}

// Invoke the build with a separate workspace for each executor,
// and with GOPATH set to that workspace
node ('windows-release') {
    ws("${WORKSPACE}_${EXECUTOR_NUMBER}") {
        withEnv(["GOPATH=${pwd()}"]) {
            try {
                notifySlack()
                doBuild()
            } catch (e) {
                currentBuild.result = 'FAILURE'
                throw e
            } finally {
                notifySlack(currentBuild.result)
            }
        }
    }
}