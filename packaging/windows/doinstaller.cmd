:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: $2 is full path to certificate.pfx file
:: $3 is the password
:: todo: specify output?
::
:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
For %%A in ("%1") do Set Folder=%%~dpA
:: Capture the version - this is the only way to store it in a .cmd variable
for /f %%i in ('%Folder%winresource.exe -v') do set BUILDVER=%%i

:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
SignTool.exe sign /fd sha256 /a /f %2 /p %3 /tr http://tsa.starfieldtech.com %1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
"%ProgramFiles(x86)%\Inno Setup 5\iscc.exe" /DMyExePathName=%1 /DMyAppVersion=%BUILDVER% "/sSignCommand=signtool.exe sign /f %2 /p %3 /tr http://tsa.starfieldtech.com /td SHA256 $f" setup_windows.iss