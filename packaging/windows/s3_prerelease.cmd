:: Based on s3_index.sh

IF [%BUCKET_NAME%]==[] (
    echo "No BUCKET_NAME, setting to prerelease.keybase.io"
    set BUCKET_NAME=prerelease.keybase.io
)

echo "Loading release tool"
go install github.com/keybase/release
set release_bin=%GOPATH%\bin\release.exe

echo "Creating index files"
%release_bin% index-html --bucket-name=%BUCKET_NAME% --prefixes="windows/" --upload="windows/index.html"

echo "Checking if we need to promote a release for testing"
%release_bin% promote-test-releases --bucket-name=%BUCKET_NAME% --platform=windows

echo "Checking if we need to promote a release"
%release_bin% promote-releases --bucket-name=%BUCKET_NAME% --platform=windows
