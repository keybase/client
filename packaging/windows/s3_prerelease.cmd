:: Based on s3_index.sh

IF [%BUCKET_NAME%]==[] (
    echo "No BUCKET_NAME, setting to prerelease.keybase.io"
    set BUCKET_NAME=prerelease.keybase.io
)

echo "Loading release tool"
go install github.com/keybase/release
set release_bin=%GOPATH%\bin\windows_386\release.exe
set SAVE_DIR=%TEMP%\s3index

rem Clear files
rmdir /s /q %SAVE_DIR%
mkdir %SAVE_DIR%

echo "Creating index files"
%release_bin% index-html --bucket-name=%BUCKET_NAME% --prefixes="darwin/,linux_binaries/deb/,linux_binaries/rpm/,windows/" --dest=%SAVE_DIR%/index.html
:: %release_bin% index-html --bucket-name=%BUCKET_NAME% --prefixes="electron-sourcemaps/" --dest="%%BUCKET_NAME%%/electron-sourcemaps/index.html"

echo "Linking latest"
%release_bin% latest --bucket-name=%BUCKET_NAME%

rem Disable multi-part is so we have normal etags
echo "Syncing"
:: s3cmd sync --acl-public --disable-multipart %%SAVE_DIR%5\* s3://%%BUCKET_NAME%%/
"%ProgramFiles%\S3 Browser\s3browser-con.exe" upload keybase %SAVE_DIR% %BUCKET_NAME%
