:: Sign keybase.exe and generate a signed installer, with an embedded signed uninsaller
:: $1 is full path to keybase.exe
:: todo: specify output?
::
:: get the target build folder. Assume winresource.exe has been built.
:: If not, go there and do "go generate"
For %%A in ("%1") do Set Folder=%%~dpA
:: Capture the version - this is the only way to store it in a .cmd variable
for /f %%i in ('%Folder%winresource.exe -v') do set BUILDVER=%%i
echo %BUILDVER%


:: Other alternate time servers:
::   http://timestamp.verisign.com/scripts/timstamp.dll
::   http://timestamp.globalsign.com/scripts/timestamp.dll
::   http://tsa.starfieldtech.com
::   http://timestamp.comodoca.com/authenticode
::   http://timestamp.digicert.com
SignTool.exe sign /a /tr http://timestamp.digicert.com %1
IF %ERRORLEVEL% NEQ 0 (
  EXIT /B 1
)
"%ProgramFiles(x86)%\Inno Setup 5\iscc.exe" /DMyExePathName=%1 /DMyAppVersion=%BUILDVER% "/sSignCommand=signtool.exe sign /tr http://timestamp.digicert.com $f" setup_windows.iss