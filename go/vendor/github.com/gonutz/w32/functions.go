package w32

import (
	"errors"
	"fmt"
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")
	comctl32 = syscall.NewLazyDLL("comctl32.dll")
	comdlg32 = syscall.NewLazyDLL("comdlg32.dll")
	dwmapi   = syscall.NewLazyDLL("dwmapi.dll")
	gdi32    = syscall.NewLazyDLL("gdi32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	ole32    = syscall.NewLazyDLL("ole32.dll")
	oleaut32 = syscall.NewLazyDLL("oleaut32")
	opengl32 = syscall.NewLazyDLL("opengl32.dll")
	psapi    = syscall.NewLazyDLL("psapi.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	gdiplus  = syscall.NewLazyDLL("gdiplus.dll")
	version  = syscall.NewLazyDLL("version.dll")
	winmm    = syscall.NewLazyDLL("winmm.dll")

	registerClassEx               = user32.NewProc("RegisterClassExW")
	loadIcon                      = user32.NewProc("LoadIconW")
	loadCursor                    = user32.NewProc("LoadCursorW")
	showWindow                    = user32.NewProc("ShowWindow")
	showWindowAsync               = user32.NewProc("ShowWindowAsync")
	updateWindow                  = user32.NewProc("UpdateWindow")
	createWindow                  = user32.NewProc("CreateWindowW")
	createWindowEx                = user32.NewProc("CreateWindowExW")
	adjustWindowRect              = user32.NewProc("AdjustWindowRect")
	adjustWindowRectEx            = user32.NewProc("AdjustWindowRectEx")
	destroyWindow                 = user32.NewProc("DestroyWindow")
	defWindowProc                 = user32.NewProc("DefWindowProcW")
	defDlgProc                    = user32.NewProc("DefDlgProcW")
	postQuitMessage               = user32.NewProc("PostQuitMessage")
	getMessage                    = user32.NewProc("GetMessageW")
	translateMessage              = user32.NewProc("TranslateMessage")
	dispatchMessage               = user32.NewProc("DispatchMessageW")
	sendMessage                   = user32.NewProc("SendMessageW")
	postMessage                   = user32.NewProc("PostMessageW")
	waitMessage                   = user32.NewProc("WaitMessage")
	setWindowText                 = user32.NewProc("SetWindowTextW")
	getWindowTextLength           = user32.NewProc("GetWindowTextLengthW")
	getWindowText                 = user32.NewProc("GetWindowTextW")
	getWindowRect                 = user32.NewProc("GetWindowRect")
	moveWindow                    = user32.NewProc("MoveWindow")
	screenToClient                = user32.NewProc("ScreenToClient")
	callWindowProc                = user32.NewProc("CallWindowProcW")
	setWindowLong                 = user32.NewProc("SetWindowLongW")
	setWindowLongPtr              = user32.NewProc("SetWindowLongW")
	getWindowLong                 = user32.NewProc("GetWindowLongW")
	getWindowLongPtr              = user32.NewProc("GetWindowLongW")
	enableWindow                  = user32.NewProc("EnableWindow")
	isWindowEnabled               = user32.NewProc("IsWindowEnabled")
	isWindowVisible               = user32.NewProc("IsWindowVisible")
	setFocus                      = user32.NewProc("SetFocus")
	invalidateRect                = user32.NewProc("InvalidateRect")
	getClientRect                 = user32.NewProc("GetClientRect")
	getDC                         = user32.NewProc("GetDC")
	releaseDC                     = user32.NewProc("ReleaseDC")
	setCapture                    = user32.NewProc("SetCapture")
	releaseCapture                = user32.NewProc("ReleaseCapture")
	getWindowThreadProcessId      = user32.NewProc("GetWindowThreadProcessId")
	messageBox                    = user32.NewProc("MessageBoxW")
	getSystemMetrics              = user32.NewProc("GetSystemMetrics")
	copyRect                      = user32.NewProc("CopyRect")
	equalRect                     = user32.NewProc("EqualRect")
	inflateRect                   = user32.NewProc("InflateRect")
	intersectRect                 = user32.NewProc("IntersectRect")
	isRectEmpty                   = user32.NewProc("IsRectEmpty")
	offsetRect                    = user32.NewProc("OffsetRect")
	ptInRect                      = user32.NewProc("PtInRect")
	setRect                       = user32.NewProc("SetRect")
	setRectEmpty                  = user32.NewProc("SetRectEmpty")
	subtractRect                  = user32.NewProc("SubtractRect")
	unionRect                     = user32.NewProc("UnionRect")
	createDialogParam             = user32.NewProc("CreateDialogParamW")
	dialogBoxParam                = user32.NewProc("DialogBoxParamW")
	getDlgItem                    = user32.NewProc("GetDlgItem")
	drawIcon                      = user32.NewProc("DrawIcon")
	clientToScreen                = user32.NewProc("ClientToScreen")
	isDialogMessage               = user32.NewProc("IsDialogMessageW")
	isWindow                      = user32.NewProc("IsWindow")
	endDialog                     = user32.NewProc("EndDialog")
	peekMessage                   = user32.NewProc("PeekMessageW")
	createAcceleratorTable        = user32.NewProc("CreateAcceleratorTableW")
	translateAccelerator          = user32.NewProc("TranslateAcceleratorW")
	setWindowPos                  = user32.NewProc("SetWindowPos")
	fillRect                      = user32.NewProc("FillRect")
	drawText                      = user32.NewProc("DrawTextW")
	addClipboardFormatListener    = user32.NewProc("AddClipboardFormatListener")
	removeClipboardFormatListener = user32.NewProc("RemoveClipboardFormatListener")
	openClipboard                 = user32.NewProc("OpenClipboard")
	closeClipboard                = user32.NewProc("CloseClipboard")
	enumClipboardFormats          = user32.NewProc("EnumClipboardFormats")
	getClipboardData              = user32.NewProc("GetClipboardData")
	setClipboardData              = user32.NewProc("SetClipboardData")
	emptyClipboard                = user32.NewProc("EmptyClipboard")
	getClipboardFormatName        = user32.NewProc("GetClipboardFormatNameW")
	isClipboardFormatAvailable    = user32.NewProc("IsClipboardFormatAvailable")
	beginPaint                    = user32.NewProc("BeginPaint")
	endPaint                      = user32.NewProc("EndPaint")
	getKeyboardState              = user32.NewProc("GetKeyboardState")
	mapVirtualKey                 = user32.NewProc("MapVirtualKeyW")
	mapVirtualKeyEx               = user32.NewProc("MapVirtualKeyExW")
	getAsyncKeyState              = user32.NewProc("GetAsyncKeyState")
	toAscii                       = user32.NewProc("ToAscii")
	swapMouseButton               = user32.NewProc("SwapMouseButton")
	getCursorPos                  = user32.NewProc("GetCursorPos")
	setCursorPos                  = user32.NewProc("SetCursorPos")
	setCursor                     = user32.NewProc("SetCursor")
	createIcon                    = user32.NewProc("CreateIcon")
	destroyIcon                   = user32.NewProc("DestroyIcon")
	monitorFromPoint              = user32.NewProc("MonitorFromPoint")
	monitorFromRect               = user32.NewProc("MonitorFromRect")
	monitorFromWindow             = user32.NewProc("MonitorFromWindow")
	getMonitorInfo                = user32.NewProc("GetMonitorInfoW")
	enumDisplayMonitors           = user32.NewProc("EnumDisplayMonitors")
	enumDisplaySettingsEx         = user32.NewProc("EnumDisplaySettingsExW")
	changeDisplaySettingsEx       = user32.NewProc("ChangeDisplaySettingsExW")
	sendInput                     = user32.NewProc("SendInput")
	setWindowsHookEx              = user32.NewProc("SetWindowsHookExW")
	unhookWindowsHookEx           = user32.NewProc("UnhookWindowsHookEx")
	callNextHookEx                = user32.NewProc("CallNextHookEx")
	getWindowPlacement            = user32.NewProc("GetWindowPlacement")
	setWindowPlacement            = user32.NewProc("SetWindowPlacement")
	showCursor                    = user32.NewProc("ShowCursor")
	loadImage                     = user32.NewProc("LoadImageW")
	getForegroundWindow           = user32.NewProc("GetForegroundWindow")
	findWindow                    = user32.NewProc("FindWindowW")
	getClassName                  = user32.NewProc("GetClassNameW")
	getMenu                       = user32.NewProc("GetMenu")
	getSubMenu                    = user32.NewProc("GetSubMenu")
	checkMenuItem                 = user32.NewProc("CheckMenuItem")
	getDesktopWindow              = user32.NewProc("GetDesktopWindow")
	getRawInputData               = user32.NewProc("GetRawInputData")
	registerRawInputDevices       = user32.NewProc("RegisterRawInputDevices")
	setTimer                      = user32.NewProc("SetTimer")
	getActiveWindow               = user32.NewProc("GetActiveWindow")
	messageBeep                   = user32.NewProc("MessageBeep")
	getCaretBlinkTime             = user32.NewProc("GetCaretBlinkTime")
	getWindowDC                   = user32.NewProc("GetWindowDC")
	enumWindows                   = user32.NewProc("EnumWindows")
	getTopWindow                  = user32.NewProc("GetTopWindow")
	getWindow                     = user32.NewProc("GetWindow")
	getKeyState                   = user32.NewProc("GetKeyState")

	regCreateKeyEx     = advapi32.NewProc("RegCreateKeyExW")
	regOpenKeyEx       = advapi32.NewProc("RegOpenKeyExW")
	regCloseKey        = advapi32.NewProc("RegCloseKey")
	regGetValue        = advapi32.NewProc("RegGetValueW")
	regEnumKeyEx       = advapi32.NewProc("RegEnumKeyExW")
	regSetValueEx      = advapi32.NewProc("RegSetValueExW")
	regDeleteKeyValue  = advapi32.NewProc("RegDeleteKeyValueW")
	regDeleteValue     = advapi32.NewProc("RegDeleteValueW")
	regDeleteTree      = advapi32.NewProc("RegDeleteTreeW")
	openEventLog       = advapi32.NewProc("OpenEventLogW")
	readEventLog       = advapi32.NewProc("ReadEventLogW")
	closeEventLog      = advapi32.NewProc("CloseEventLog")
	openSCManager      = advapi32.NewProc("OpenSCManagerW")
	closeServiceHandle = advapi32.NewProc("CloseServiceHandle")
	openService        = advapi32.NewProc("OpenServiceW")
	startService       = advapi32.NewProc("StartServiceW")
	controlService     = advapi32.NewProc("ControlService")

	initCommonControlsEx    = comctl32.NewProc("InitCommonControlsEx")
	imageList_Create        = comctl32.NewProc("ImageList_Create")
	imageList_Destroy       = comctl32.NewProc("ImageList_Destroy")
	imageList_GetImageCount = comctl32.NewProc("ImageList_GetImageCount")
	imageList_SetImageCount = comctl32.NewProc("ImageList_SetImageCount")
	imageList_Add           = comctl32.NewProc("ImageList_Add")
	imageList_ReplaceIcon   = comctl32.NewProc("ImageList_ReplaceIcon")
	imageList_Remove        = comctl32.NewProc("ImageList_Remove")
	trackMouseEvent         = comctl32.NewProc("_TrackMouseEvent")

	getSaveFileName      = comdlg32.NewProc("GetSaveFileNameW")
	getOpenFileName      = comdlg32.NewProc("GetOpenFileNameW")
	commDlgExtendedError = comdlg32.NewProc("CommDlgExtendedError")

	dwmDefWindowProc                 = dwmapi.NewProc("DwmDefWindowProc")
	dwmEnableBlurBehindWindow        = dwmapi.NewProc("DwmEnableBlurBehindWindow")
	dwmEnableMMCSS                   = dwmapi.NewProc("DwmEnableMMCSS")
	dwmExtendFrameIntoClientArea     = dwmapi.NewProc("DwmExtendFrameIntoClientArea")
	dwmFlush                         = dwmapi.NewProc("DwmFlush")
	dwmGetColorizationColor          = dwmapi.NewProc("DwmGetColorizationColor")
	dwmGetCompositionTimingInfo      = dwmapi.NewProc("DwmGetCompositionTimingInfo")
	dwmGetTransportAttributes        = dwmapi.NewProc("DwmGetTransportAttributes")
	dwmGetWindowAttribute            = dwmapi.NewProc("DwmGetWindowAttribute")
	dwmInvalidateIconicBitmaps       = dwmapi.NewProc("DwmInvalidateIconicBitmaps")
	dwmIsCompositionEnabled          = dwmapi.NewProc("DwmIsCompositionEnabled")
	dwmModifyPreviousDxFrameDuration = dwmapi.NewProc("DwmModifyPreviousDxFrameDuration")
	dwmQueryThumbnailSourceSize      = dwmapi.NewProc("DwmQueryThumbnailSourceSize")
	dwmRegisterThumbnail             = dwmapi.NewProc("DwmRegisterThumbnail")
	dwmRenderGesture                 = dwmapi.NewProc("DwmRenderGesture")
	dwmSetDxFrameDuration            = dwmapi.NewProc("DwmSetDxFrameDuration")
	dwmSetIconicLivePreviewBitmap    = dwmapi.NewProc("DwmSetIconicLivePreviewBitmap")
	dwmSetIconicThumbnail            = dwmapi.NewProc("DwmSetIconicThumbnail")
	dwmSetPresentParameters          = dwmapi.NewProc("DwmSetPresentParameters")
	dwmSetWindowAttribute            = dwmapi.NewProc("DwmSetWindowAttribute")
	dwmShowContact                   = dwmapi.NewProc("DwmShowContact")
	dwmTetherContact                 = dwmapi.NewProc("DwmTetherContact")
	dwmTransitionOwnedWindow         = dwmapi.NewProc("DwmTransitionOwnedWindow")
	dwmUnregisterThumbnail           = dwmapi.NewProc("DwmUnregisterThumbnail")
	dwmUpdateThumbnailProperties     = dwmapi.NewProc("DwmUpdateThumbnailProperties")

	getDeviceCaps             = gdi32.NewProc("GetDeviceCaps")
	deleteObject              = gdi32.NewProc("DeleteObject")
	createFontIndirect        = gdi32.NewProc("CreateFontIndirectW")
	abortDoc                  = gdi32.NewProc("AbortDoc")
	bitBlt                    = gdi32.NewProc("BitBlt")
	patBlt                    = gdi32.NewProc("PatBlt")
	closeEnhMetaFile          = gdi32.NewProc("CloseEnhMetaFile")
	copyEnhMetaFile           = gdi32.NewProc("CopyEnhMetaFileW")
	createBrushIndirect       = gdi32.NewProc("CreateBrushIndirect")
	createCompatibleDC        = gdi32.NewProc("CreateCompatibleDC")
	createCompatibleBitmap    = gdi32.NewProc("CreateCompatibleBitmap")
	createDC                  = gdi32.NewProc("CreateDCW")
	createDIBSection          = gdi32.NewProc("CreateDIBSection")
	createEnhMetaFile         = gdi32.NewProc("CreateEnhMetaFileW")
	createIC                  = gdi32.NewProc("CreateICW")
	deleteDC                  = gdi32.NewProc("DeleteDC")
	deleteEnhMetaFile         = gdi32.NewProc("DeleteEnhMetaFile")
	ellipse                   = gdi32.NewProc("Ellipse")
	endDoc                    = gdi32.NewProc("EndDoc")
	endPage                   = gdi32.NewProc("EndPage")
	extCreatePen              = gdi32.NewProc("ExtCreatePen")
	getEnhMetaFile            = gdi32.NewProc("GetEnhMetaFileW")
	getEnhMetaFileHeader      = gdi32.NewProc("GetEnhMetaFileHeader")
	getObject                 = gdi32.NewProc("GetObjectW")
	getStockObject            = gdi32.NewProc("GetStockObject")
	getTextExtentExPoint      = gdi32.NewProc("GetTextExtentExPointW")
	getTextExtentPoint32      = gdi32.NewProc("GetTextExtentPoint32W")
	getTextMetrics            = gdi32.NewProc("GetTextMetricsW")
	lineTo                    = gdi32.NewProc("LineTo")
	moveToEx                  = gdi32.NewProc("MoveToEx")
	playEnhMetaFile           = gdi32.NewProc("PlayEnhMetaFile")
	rectangle                 = gdi32.NewProc("Rectangle")
	resetDC                   = gdi32.NewProc("ResetDCW")
	selectObject              = gdi32.NewProc("SelectObject")
	setBkMode                 = gdi32.NewProc("SetBkMode")
	setBrushOrgEx             = gdi32.NewProc("SetBrushOrgEx")
	setStretchBltMode         = gdi32.NewProc("SetStretchBltMode")
	setTextColor              = gdi32.NewProc("SetTextColor")
	setBkColor                = gdi32.NewProc("SetBkColor")
	startDoc                  = gdi32.NewProc("StartDocW")
	startPage                 = gdi32.NewProc("StartPage")
	stretchBlt                = gdi32.NewProc("StretchBlt")
	setDIBitsToDevice         = gdi32.NewProc("SetDIBitsToDevice")
	choosePixelFormat         = gdi32.NewProc("ChoosePixelFormat")
	describePixelFormat       = gdi32.NewProc("DescribePixelFormat")
	getEnhMetaFilePixelFormat = gdi32.NewProc("GetEnhMetaFilePixelFormat")
	getPixelFormat            = gdi32.NewProc("GetPixelFormat")
	setPixelFormat            = gdi32.NewProc("SetPixelFormat")
	swapBuffers               = gdi32.NewProc("SwapBuffers")
	textOut                   = gdi32.NewProc("TextOutW")
	createSolidBrush          = gdi32.NewProc("CreateSolidBrush")
	getDIBits                 = gdi32.NewProc("GetDIBits")

	getModuleHandle            = kernel32.NewProc("GetModuleHandleW")
	mulDiv                     = kernel32.NewProc("MulDiv")
	getConsoleWindow           = kernel32.NewProc("GetConsoleWindow")
	getCurrentThread           = kernel32.NewProc("GetCurrentThread")
	getLogicalDrives           = kernel32.NewProc("GetLogicalDrives")
	getUserDefaultLCID         = kernel32.NewProc("GetUserDefaultLCID")
	lstrlen                    = kernel32.NewProc("lstrlenW")
	lstrcpy                    = kernel32.NewProc("lstrcpyW")
	globalAlloc                = kernel32.NewProc("GlobalAlloc")
	globalFree                 = kernel32.NewProc("GlobalFree")
	globalLock                 = kernel32.NewProc("GlobalLock")
	globalUnlock               = kernel32.NewProc("GlobalUnlock")
	moveMemory                 = kernel32.NewProc("RtlMoveMemory")
	findResource               = kernel32.NewProc("FindResourceW")
	sizeofResource             = kernel32.NewProc("SizeofResource")
	lockResource               = kernel32.NewProc("LockResource")
	loadResource               = kernel32.NewProc("LoadResource")
	getLastError               = kernel32.NewProc("GetLastError")
	openProcess                = kernel32.NewProc("OpenProcess")
	terminateProcess           = kernel32.NewProc("TerminateProcess")
	closeHandle                = kernel32.NewProc("CloseHandle")
	createToolhelp32Snapshot   = kernel32.NewProc("CreateToolhelp32Snapshot")
	module32First              = kernel32.NewProc("Module32FirstW")
	module32Next               = kernel32.NewProc("Module32NextW")
	getSystemTimes             = kernel32.NewProc("GetSystemTimes")
	getConsoleScreenBufferInfo = kernel32.NewProc("GetConsoleScreenBufferInfo")
	setConsoleTextAttribute    = kernel32.NewProc("SetConsoleTextAttribute")
	getDiskFreeSpaceEx         = kernel32.NewProc("GetDiskFreeSpaceExW")
	getProcessTimes            = kernel32.NewProc("GetProcessTimes")
	setSystemTime              = kernel32.NewProc("SetSystemTime")
	getSystemTime              = kernel32.NewProc("GetSystemTime")
	getSystemTimeAsFileTime    = kernel32.NewProc("GetSystemTimeAsFileTime")
	copyMemory                 = kernel32.NewProc("RtlCopyMemory")
	getCurrentProcessId        = kernel32.NewProc("GetCurrentProcessId")
	getVersion                 = kernel32.NewProc("GetVersion")
	setEnvironmentVariable     = kernel32.NewProc("SetEnvironmentVariableW")
	getComputerName            = kernel32.NewProc("GetComputerNameW")

	coInitializeEx        = ole32.NewProc("CoInitializeEx")
	coInitialize          = ole32.NewProc("CoInitialize")
	coUninitialize        = ole32.NewProc("CoUninitialize")
	createStreamOnHGlobal = ole32.NewProc("CreateStreamOnHGlobal")

	variantInit        = oleaut32.NewProc("VariantInit")
	sysAllocString     = oleaut32.NewProc("SysAllocString")
	sysFreeString      = oleaut32.NewProc("SysFreeString")
	sysStringLen       = oleaut32.NewProc("SysStringLen")
	createDispTypeInfo = oleaut32.NewProc("CreateDispTypeInfo")
	createStdDispatch  = oleaut32.NewProc("CreateStdDispatch")

	wglCreateContext      = opengl32.NewProc("wglCreateContext")
	wglCreateLayerContext = opengl32.NewProc("wglCreateLayerContext")
	wglDeleteContext      = opengl32.NewProc("wglDeleteContext")
	wglGetProcAddress     = opengl32.NewProc("wglGetProcAddress")
	wglMakeCurrent        = opengl32.NewProc("wglMakeCurrent")
	wglShareLists         = opengl32.NewProc("wglShareLists")

	enumProcesses = psapi.NewProc("EnumProcesses")

	sHBrowseForFolder   = shell32.NewProc("SHBrowseForFolderW")
	sHGetPathFromIDList = shell32.NewProc("SHGetPathFromIDListW")
	dragAcceptFiles     = shell32.NewProc("DragAcceptFiles")
	dragQueryFile       = shell32.NewProc("DragQueryFileW")
	dragQueryPoint      = shell32.NewProc("DragQueryPoint")
	dragFinish          = shell32.NewProc("DragFinish")
	shellExecute        = shell32.NewProc("ShellExecuteW")
	extractIcon         = shell32.NewProc("ExtractIconW")

	gdipCreateBitmapFromFile     = gdiplus.NewProc("GdipCreateBitmapFromFile")
	gdipCreateBitmapFromHBITMAP  = gdiplus.NewProc("GdipCreateBitmapFromHBITMAP")
	gdipCreateHBITMAPFromBitmap  = gdiplus.NewProc("GdipCreateHBITMAPFromBitmap")
	gdipCreateBitmapFromResource = gdiplus.NewProc("GdipCreateBitmapFromResource")
	gdipCreateBitmapFromStream   = gdiplus.NewProc("GdipCreateBitmapFromStream")
	gdipDisposeImage             = gdiplus.NewProc("GdipDisposeImage")
	gdiplusShutdown              = gdiplus.NewProc("GdiplusShutdown")
	gdiplusStartup               = gdiplus.NewProc("GdiplusStartup")

	getFileVersionInfoSize = version.NewProc("GetFileVersionInfoSizeW")
	getFileVersionInfo     = version.NewProc("GetFileVersionInfoW")
	verQueryValue          = version.NewProc("VerQueryValueW")

	playSound = winmm.NewProc("PlaySoundW")
)

// RegisterClassEx sets the Size of the WNDCLASSEX automatically.
func RegisterClassEx(wndClassEx *WNDCLASSEX) ATOM {
	if wndClassEx != nil {
		wndClassEx.Size = uint32(unsafe.Sizeof(*wndClassEx))
	}
	ret, _, _ := registerClassEx.Call(uintptr(unsafe.Pointer(wndClassEx)))
	return ATOM(ret)
}

func LoadIcon(instance HINSTANCE, iconName *uint16) HICON {
	ret, _, _ := loadIcon.Call(
		uintptr(instance),
		uintptr(unsafe.Pointer(iconName)),
	)
	return HICON(ret)
}

func LoadCursor(instance HINSTANCE, cursorName *uint16) HCURSOR {
	ret, _, _ := loadCursor.Call(
		uintptr(instance),
		uintptr(unsafe.Pointer(cursorName)),
	)
	return HCURSOR(ret)
}

func ShowWindow(hwnd HWND, cmdshow int) bool {
	ret, _, _ := showWindow.Call(
		uintptr(hwnd),
		uintptr(cmdshow),
	)
	return ret != 0
}

func ShowWindowAsync(hwnd HWND, cmdshow int) bool {
	ret, _, _ := showWindowAsync.Call(
		uintptr(hwnd),
		uintptr(cmdshow),
	)
	return ret != 0
}

func UpdateWindow(hwnd HWND) bool {
	ret, _, _ := updateWindow.Call(uintptr(hwnd))
	return ret != 0
}

func CreateWindow(className, windowName *uint16,
	style uint, x, y, width, height int, parent HWND, menu HMENU,
	instance HINSTANCE, param unsafe.Pointer) HWND {
	ret, _, _ := createWindowEx.Call(
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
		uintptr(style),
		uintptr(x),
		uintptr(y),
		uintptr(width),
		uintptr(height),
		uintptr(parent),
		uintptr(menu),
		uintptr(instance),
		uintptr(param),
	)
	return HWND(ret)
}

func CreateWindowEx(exStyle uint, className, windowName *uint16,
	style uint, x, y, width, height int, parent HWND, menu HMENU,
	instance HINSTANCE, param unsafe.Pointer) HWND {
	ret, _, _ := createWindowEx.Call(
		uintptr(exStyle),
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
		uintptr(style),
		uintptr(x),
		uintptr(y),
		uintptr(width),
		uintptr(height),
		uintptr(parent),
		uintptr(menu),
		uintptr(instance),
		uintptr(param),
	)
	return HWND(ret)
}

func AdjustWindowRectEx(rect *RECT, style uint, menu bool, exStyle uint) bool {
	ret, _, _ := adjustWindowRectEx.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(style),
		uintptr(BoolToBOOL(menu)),
		uintptr(exStyle),
	)
	return ret != 0
}

func AdjustWindowRect(rect *RECT, style uint, menu bool) bool {
	ret, _, _ := adjustWindowRect.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(style),
		uintptr(BoolToBOOL(menu)),
	)
	return ret != 0
}

func DestroyWindow(hwnd HWND) bool {
	ret, _, _ := destroyWindow.Call(uintptr(hwnd))
	return ret != 0
}

func DefWindowProc(hwnd HWND, msg uint32, wParam, lParam uintptr) uintptr {
	ret, _, _ := defWindowProc.Call(
		uintptr(hwnd),
		uintptr(msg),
		wParam,
		lParam,
	)
	return ret
}

func DefDlgProc(hwnd HWND, msg uint32, wParam, lParam uintptr) uintptr {
	ret, _, _ := defDlgProc.Call(
		uintptr(hwnd),
		uintptr(msg),
		wParam,
		lParam,
	)
	return ret
}

func PostQuitMessage(exitCode int) {
	postQuitMessage.Call(uintptr(exitCode))
}

func GetMessage(msg *MSG, hwnd HWND, msgFilterMin, msgFilterMax uint32) int {
	ret, _, _ := getMessage.Call(
		uintptr(unsafe.Pointer(msg)),
		uintptr(hwnd),
		uintptr(msgFilterMin),
		uintptr(msgFilterMax),
	)
	return int(ret)
}

func TranslateMessage(msg *MSG) bool {
	ret, _, _ := translateMessage.Call(uintptr(unsafe.Pointer(msg)))
	return ret != 0

}

func DispatchMessage(msg *MSG) uintptr {
	ret, _, _ := dispatchMessage.Call(uintptr(unsafe.Pointer(msg)))
	return ret

}

func SendMessage(hwnd HWND, msg uint32, wParam, lParam uintptr) uintptr {
	ret, _, _ := sendMessage.Call(
		uintptr(hwnd),
		uintptr(msg),
		wParam,
		lParam,
	)
	return ret
}

func PostMessage(hwnd HWND, msg uint32, wParam, lParam uintptr) bool {
	ret, _, _ := postMessage.Call(
		uintptr(hwnd),
		uintptr(msg),
		wParam,
		lParam,
	)
	return ret != 0
}

func WaitMessage() bool {
	ret, _, _ := waitMessage.Call()
	return ret != 0
}

func SetWindowText(hwnd HWND, text string) {
	setWindowText.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(text))),
	)
}

func GetWindowTextLength(hwnd HWND) int {
	ret, _, _ := getWindowTextLength.Call(uintptr(hwnd))
	return int(ret)
}

func GetWindowText(hwnd HWND) string {
	textLen := GetWindowTextLength(hwnd) + 1
	buf := make([]uint16, textLen)
	len, _, _ := getWindowText.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(textLen),
	)
	return syscall.UTF16ToString(buf[:len])
}

func GetWindowRect(hwnd HWND) *RECT {
	var rect RECT
	getWindowRect.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&rect)),
	)
	return &rect
}

func MoveWindow(hwnd HWND, x, y, width, height int, repaint bool) bool {
	ret, _, _ := moveWindow.Call(
		uintptr(hwnd),
		uintptr(x),
		uintptr(y),
		uintptr(width),
		uintptr(height),
		uintptr(BoolToBOOL(repaint)),
	)
	return ret != 0

}

func ScreenToClient(hwnd HWND, x, y int) (X, Y int, ok bool) {
	pt := POINT{X: int32(x), Y: int32(y)}
	ret, _, _ := screenToClient.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&pt)),
	)
	return int(pt.X), int(pt.Y), ret != 0
}

func CallWindowProc(preWndProc uintptr, hwnd HWND, msg uint32, wParam, lParam uintptr) uintptr {
	ret, _, _ := callWindowProc.Call(
		preWndProc,
		uintptr(hwnd),
		uintptr(msg),
		wParam,
		lParam,
	)
	return ret
}

func SetWindowLong(hwnd HWND, index int, value uint32) uint32 {
	ret, _, _ := setWindowLong.Call(
		uintptr(hwnd),
		uintptr(index),
		uintptr(value),
	)
	return uint32(ret)
}

func SetWindowLongPtr(hwnd HWND, index int, value uintptr) uintptr {
	ret, _, _ := setWindowLongPtr.Call(
		uintptr(hwnd),
		uintptr(index),
		value,
	)
	return ret
}

func GetWindowLong(hwnd HWND, index int) int32 {
	ret, _, _ := getWindowLong.Call(
		uintptr(hwnd),
		uintptr(index),
	)
	return int32(ret)
}

func GetWindowLongPtr(hwnd HWND, index int) uintptr {
	ret, _, _ := getWindowLongPtr.Call(
		uintptr(hwnd),
		uintptr(index),
	)
	return ret
}

func EnableWindow(hwnd HWND, b bool) bool {
	ret, _, _ := enableWindow.Call(
		uintptr(hwnd),
		uintptr(BoolToBOOL(b)),
	)
	return ret != 0
}

func IsWindowEnabled(hwnd HWND) bool {
	ret, _, _ := isWindowEnabled.Call(uintptr(hwnd))
	return ret != 0
}

func IsWindowVisible(hwnd HWND) bool {
	ret, _, _ := isWindowVisible.Call(uintptr(hwnd))
	return ret != 0
}

func SetFocus(hwnd HWND) HWND {
	ret, _, _ := setFocus.Call(uintptr(hwnd))
	return HWND(ret)
}

func InvalidateRect(hwnd HWND, rect *RECT, erase bool) bool {
	ret, _, _ := invalidateRect.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(rect)),
		uintptr(BoolToBOOL(erase)),
	)
	return ret != 0
}

func GetClientRect(hwnd HWND) *RECT {
	var rect RECT
	ret, _, _ := getClientRect.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&rect)))
	if ret == 0 {
		return nil
	}
	return &rect
}

func GetDC(hwnd HWND) HDC {
	ret, _, _ := getDC.Call(uintptr(hwnd))
	return HDC(ret)
}

func ReleaseDC(hwnd HWND, hDC HDC) bool {
	ret, _, _ := releaseDC.Call(
		uintptr(hwnd),
		uintptr(hDC),
	)
	return ret != 0
}

func SetCapture(hwnd HWND) HWND {
	ret, _, _ := setCapture.Call(uintptr(hwnd))
	return HWND(ret)
}

func ReleaseCapture() bool {
	ret, _, _ := releaseCapture.Call()
	return ret != 0
}

func GetWindowThreadProcessId(hwnd HWND) (HANDLE, DWORD) {
	var processId DWORD
	ret, _, _ := getWindowThreadProcessId.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&processId)),
	)
	return HANDLE(ret), processId
}

func MessageBox(hwnd HWND, text, caption string, flags uint) int {
	ret, _, _ := messageBox.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(text))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(caption))),
		uintptr(flags),
	)
	return int(ret)
}

func GetSystemMetrics(index int) int {
	ret, _, _ := getSystemMetrics.Call(uintptr(index))
	return int(ret)
}

func CopyRect(dst, src *RECT) bool {
	ret, _, _ := copyRect.Call(
		uintptr(unsafe.Pointer(dst)),
		uintptr(unsafe.Pointer(src)),
	)
	return ret != 0
}

func EqualRect(rect1, rect2 *RECT) bool {
	ret, _, _ := equalRect.Call(
		uintptr(unsafe.Pointer(rect1)),
		uintptr(unsafe.Pointer(rect2)),
	)
	return ret != 0
}

func InflateRect(rect *RECT, dx, dy int) bool {
	ret, _, _ := inflateRect.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(dx),
		uintptr(dy),
	)
	return ret != 0
}

func IntersectRect(dst, src1, src2 *RECT) bool {
	ret, _, _ := intersectRect.Call(
		uintptr(unsafe.Pointer(dst)),
		uintptr(unsafe.Pointer(src1)),
		uintptr(unsafe.Pointer(src2)),
	)
	return ret != 0
}

func IsRectEmpty(rect *RECT) bool {
	ret, _, _ := isRectEmpty.Call(uintptr(unsafe.Pointer(rect)))
	return ret != 0
}

func OffsetRect(rect *RECT, dx, dy int) bool {
	ret, _, _ := offsetRect.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(dx),
		uintptr(dy),
	)
	return ret != 0
}

func PtInRect(rect *RECT, x, y int) bool {
	pt := POINT{X: int32(x), Y: int32(y)}
	ret, _, _ := ptInRect.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(unsafe.Pointer(&pt)),
	)
	return ret != 0
}

func SetRect(rect *RECT, left, top, right, bottom int) bool {
	ret, _, _ := setRect.Call(
		uintptr(unsafe.Pointer(rect)),
		uintptr(left),
		uintptr(top),
		uintptr(right),
		uintptr(bottom),
	)
	return ret != 0
}

func SetRectEmpty(rect *RECT) bool {
	ret, _, _ := setRectEmpty.Call(uintptr(unsafe.Pointer(rect)))
	return ret != 0
}

func SubtractRect(dst, src1, src2 *RECT) bool {
	ret, _, _ := subtractRect.Call(
		uintptr(unsafe.Pointer(dst)),
		uintptr(unsafe.Pointer(src1)),
		uintptr(unsafe.Pointer(src2)),
	)
	return ret != 0
}

func UnionRect(dst, src1, src2 *RECT) bool {
	ret, _, _ := unionRect.Call(
		uintptr(unsafe.Pointer(dst)),
		uintptr(unsafe.Pointer(src1)),
		uintptr(unsafe.Pointer(src2)),
	)
	return ret != 0
}

func CreateDialog(hInstance HINSTANCE, lpTemplate *uint16, hWndParent HWND, lpDialogProc uintptr) HWND {
	ret, _, _ := createDialogParam.Call(
		uintptr(hInstance),
		uintptr(unsafe.Pointer(lpTemplate)),
		uintptr(hWndParent),
		lpDialogProc,
		0,
	)
	return HWND(ret)
}

func DialogBox(hInstance HINSTANCE, lpTemplateName *uint16, hWndParent HWND, lpDialogProc uintptr) int {
	ret, _, _ := dialogBoxParam.Call(
		uintptr(hInstance),
		uintptr(unsafe.Pointer(lpTemplateName)),
		uintptr(hWndParent),
		lpDialogProc,
		0,
	)
	return int(ret)
}

func GetDlgItem(hDlg HWND, nIDDlgItem int) HWND {
	ret, _, _ := getDlgItem.Call(
		uintptr(unsafe.Pointer(hDlg)),
		uintptr(nIDDlgItem),
	)
	return HWND(ret)
}

func DrawIcon(hDC HDC, x, y int, hIcon HICON) bool {
	ret, _, _ := drawIcon.Call(
		uintptr(unsafe.Pointer(hDC)),
		uintptr(x),
		uintptr(y),
		uintptr(unsafe.Pointer(hIcon)),
	)
	return ret != 0
}

func ClientToScreen(hwnd HWND, x, y int) (int, int) {
	pt := POINT{X: int32(x), Y: int32(y)}
	clientToScreen.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&pt)),
	)
	return int(pt.X), int(pt.Y)
}

func IsDialogMessage(hwnd HWND, msg *MSG) bool {
	ret, _, _ := isDialogMessage.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(msg)),
	)
	return ret != 0
}

func IsWindow(hwnd HWND) bool {
	ret, _, _ := isWindow.Call(uintptr(hwnd))
	return ret != 0
}

func EndDialog(hwnd HWND, nResult uintptr) bool {
	ret, _, _ := endDialog.Call(
		uintptr(hwnd),
		nResult,
	)
	return ret != 0
}

func PeekMessage(lpMsg *MSG, hwnd HWND, wMsgFilterMin, wMsgFilterMax, wRemoveMsg uint32) bool {
	ret, _, _ := peekMessage.Call(
		uintptr(unsafe.Pointer(lpMsg)),
		uintptr(hwnd),
		uintptr(wMsgFilterMin),
		uintptr(wMsgFilterMax),
		uintptr(wRemoveMsg),
	)
	return ret != 0
}

func CreateAcceleratorTable(acc []ACCEL) HACCEL {
	if len(acc) == 0 {
		return 0
	}
	ret, _, _ := createAcceleratorTable.Call(
		uintptr(unsafe.Pointer(&acc[0])),
		uintptr(len(acc)),
	)
	return HACCEL(ret)
}

func TranslateAccelerator(hwnd HWND, hAccTable HACCEL, lpMsg *MSG) bool {
	ret, _, _ := translateAccelerator.Call(
		uintptr(hwnd),
		uintptr(hAccTable),
		uintptr(unsafe.Pointer(lpMsg)),
	)
	return ret != 0
}

func SetWindowPos(hwnd, hWndInsertAfter HWND, x, y, cx, cy int, uFlags uint) bool {
	ret, _, _ := setWindowPos.Call(
		uintptr(hwnd),
		uintptr(hWndInsertAfter),
		uintptr(x),
		uintptr(y),
		uintptr(cx),
		uintptr(cy),
		uintptr(uFlags),
	)
	return ret != 0
}

func FillRect(hDC HDC, lprc *RECT, hbr HBRUSH) bool {
	ret, _, _ := fillRect.Call(
		uintptr(hDC),
		uintptr(unsafe.Pointer(lprc)),
		uintptr(hbr),
	)
	return ret != 0
}

func DrawText(hDC HDC, text string, uCount int, lpRect *RECT, uFormat uint) int {
	ret, _, _ := drawText.Call(
		uintptr(hDC),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(text))),
		uintptr(uCount),
		uintptr(unsafe.Pointer(lpRect)),
		uintptr(uFormat),
	)
	return int(ret)
}

func AddClipboardFormatListener(hwnd HWND) bool {
	ret, _, _ := addClipboardFormatListener.Call(uintptr(hwnd))
	return ret != 0
}

func RemoveClipboardFormatListener(hwnd HWND) bool {
	ret, _, _ := removeClipboardFormatListener.Call(uintptr(hwnd))
	return ret != 0
}

func OpenClipboard(hWndNewOwner HWND) bool {
	ret, _, _ := openClipboard.Call(uintptr(hWndNewOwner))
	return ret != 0
}

func CloseClipboard() bool {
	ret, _, _ := closeClipboard.Call()
	return ret != 0
}

func EnumClipboardFormats(format uint) uint {
	ret, _, _ := enumClipboardFormats.Call(uintptr(format))
	return uint(ret)
}

func GetClipboardData(uFormat uint) HANDLE {
	ret, _, _ := getClipboardData.Call(uintptr(uFormat))
	return HANDLE(ret)
}

func SetClipboardData(uFormat uint, hMem HANDLE) HANDLE {
	ret, _, _ := setClipboardData.Call(
		uintptr(uFormat),
		uintptr(hMem),
	)
	return HANDLE(ret)
}

func EmptyClipboard() bool {
	ret, _, _ := emptyClipboard.Call()
	return ret != 0
}

func GetClipboardFormatName(format uint) (string, bool) {
	cchMaxCount := 255
	buf := make([]uint16, cchMaxCount)
	ret, _, _ := getClipboardFormatName.Call(
		uintptr(format),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(cchMaxCount))

	if ret > 0 {
		return syscall.UTF16ToString(buf), true
	}

	return "Requested format does not exist or is predefined", false
}

func IsClipboardFormatAvailable(format uint) bool {
	ret, _, _ := isClipboardFormatAvailable.Call(uintptr(format))
	return ret != 0
}

func BeginPaint(hwnd HWND, paint *PAINTSTRUCT) HDC {
	ret, _, _ := beginPaint.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(paint)),
	)
	return HDC(ret)
}

func EndPaint(hwnd HWND, paint *PAINTSTRUCT) {
	beginPaint.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(paint)),
	)
}

func GetKeyboardState(lpKeyState *[]byte) bool {
	ret, _, _ := getKeyboardState.Call(uintptr(unsafe.Pointer(&(*lpKeyState)[0])))
	return ret != 0
}

func MapVirtualKey(uCode, uMapType uint) uint {
	ret, _, _ := mapVirtualKey.Call(
		uintptr(uCode),
		uintptr(uMapType),
	)
	return uint(ret)
}

func MapVirtualKeyEx(uCode, uMapType uint, dwhkl HKL) uint {
	ret, _, _ := mapVirtualKeyEx.Call(
		uintptr(uCode),
		uintptr(uMapType),
		uintptr(dwhkl),
	)
	return uint(ret)
}

func GetAsyncKeyState(vKey int) uint16 {
	ret, _, _ := getAsyncKeyState.Call(uintptr(vKey))
	return uint16(ret)
}

func ToAscii(uVirtKey, uScanCode uint, lpKeyState *byte, lpChar *uint16, uFlags uint) int {
	ret, _, _ := toAscii.Call(
		uintptr(uVirtKey),
		uintptr(uScanCode),
		uintptr(unsafe.Pointer(lpKeyState)),
		uintptr(unsafe.Pointer(lpChar)),
		uintptr(uFlags),
	)
	return int(ret)
}

func SwapMouseButton(fSwap bool) bool {
	ret, _, _ := swapMouseButton.Call(uintptr(BoolToBOOL(fSwap)))
	return ret != 0
}

func GetCursorPos() (x, y int, ok bool) {
	var pt POINT
	ret, _, _ := getCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	return int(pt.X), int(pt.Y), ret != 0
}

func SetCursorPos(x, y int) bool {
	ret, _, _ := setCursorPos.Call(
		uintptr(x),
		uintptr(y),
	)
	return ret != 0
}

func SetCursor(cursor HCURSOR) HCURSOR {
	ret, _, _ := setCursor.Call(uintptr(cursor))
	return HCURSOR(ret)
}

func CreateIcon(instance HINSTANCE, nWidth, nHeight int, cPlanes, cBitsPerPixel byte, ANDbits, XORbits *byte) HICON {
	ret, _, _ := createIcon.Call(
		uintptr(instance),
		uintptr(nWidth),
		uintptr(nHeight),
		uintptr(cPlanes),
		uintptr(cBitsPerPixel),
		uintptr(unsafe.Pointer(ANDbits)),
		uintptr(unsafe.Pointer(XORbits)),
	)
	return HICON(ret)
}

func DestroyIcon(icon HICON) bool {
	ret, _, _ := destroyIcon.Call(uintptr(icon))
	return ret != 0
}

func MonitorFromPoint(x, y int, dwFlags uint32) HMONITOR {
	ret, _, _ := monitorFromPoint.Call(
		uintptr(x),
		uintptr(y),
		uintptr(dwFlags),
	)
	return HMONITOR(ret)
}

func MonitorFromRect(rc *RECT, dwFlags uint32) HMONITOR {
	ret, _, _ := monitorFromRect.Call(
		uintptr(unsafe.Pointer(rc)),
		uintptr(dwFlags),
	)
	return HMONITOR(ret)
}

func MonitorFromWindow(hwnd HWND, dwFlags uint32) HMONITOR {
	ret, _, _ := monitorFromWindow.Call(
		uintptr(hwnd),
		uintptr(dwFlags),
	)
	return HMONITOR(ret)
}

// GetMonitorInfo automatically sets the MONITORINFO's CbSize field.
func GetMonitorInfo(hMonitor HMONITOR, lmpi *MONITORINFO) bool {
	if lmpi != nil {
		lmpi.CbSize = uint32(unsafe.Sizeof(*lmpi))
	}
	ret, _, _ := getMonitorInfo.Call(
		uintptr(hMonitor),
		uintptr(unsafe.Pointer(lmpi)),
	)
	return ret != 0
}

func EnumDisplayMonitors(hdc HDC, clip *RECT, fnEnum, dwData uintptr) bool {
	ret, _, _ := enumDisplayMonitors.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(clip)),
		fnEnum,
		dwData,
	)
	return ret != 0
}

func EnumDisplaySettingsEx(szDeviceName *uint16, iModeNum uint32, devMode *DEVMODE, dwFlags uint32) bool {
	ret, _, _ := enumDisplaySettingsEx.Call(
		uintptr(unsafe.Pointer(szDeviceName)),
		uintptr(iModeNum),
		uintptr(unsafe.Pointer(devMode)),
		uintptr(dwFlags),
	)
	return ret != 0
}

func ChangeDisplaySettingsEx(szDeviceName *uint16, devMode *DEVMODE, hwnd HWND, dwFlags uint32, lParam uintptr) int32 {
	ret, _, _ := changeDisplaySettingsEx.Call(
		uintptr(unsafe.Pointer(szDeviceName)),
		uintptr(unsafe.Pointer(devMode)),
		uintptr(hwnd),
		uintptr(dwFlags),
		lParam,
	)
	return int32(ret)
}

func SendInput(inputs ...INPUT) uint32 {
	if len(inputs) == 0 {
		return 0
	}
	ret, _, _ := sendInput.Call(
		uintptr(len(inputs)),
		uintptr(unsafe.Pointer(&inputs[0])),
		unsafe.Sizeof(inputs[0]),
	)
	return uint32(ret)
}

func SetWindowsHookEx(idHook int, lpfn HOOKPROC, hMod HINSTANCE, dwThreadId DWORD) HHOOK {
	ret, _, _ := setWindowsHookEx.Call(
		uintptr(idHook),
		uintptr(syscall.NewCallback(lpfn)),
		uintptr(hMod),
		uintptr(dwThreadId),
	)
	return HHOOK(ret)
}

func UnhookWindowsHookEx(hhk HHOOK) bool {
	ret, _, _ := unhookWindowsHookEx.Call(uintptr(hhk))
	return ret != 0
}

func CallNextHookEx(hhk HHOOK, nCode int, wParam WPARAM, lParam LPARAM) LRESULT {
	ret, _, _ := callNextHookEx.Call(
		uintptr(hhk),
		uintptr(nCode),
		uintptr(wParam),
		uintptr(lParam),
	)
	return LRESULT(ret)
}

// GetWindowPlacement automatically sets the WINDOWPLACEMENT's Length field.
func GetWindowPlacement(hwnd HWND, placement *WINDOWPLACEMENT) bool {
	if placement != nil {
		placement.Length = uint32(unsafe.Sizeof(*placement))
	}
	ret, _, _ := getWindowPlacement.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(placement)),
	)
	return ret != 0
}

func SetWindowPlacement(hwnd HWND, placement *WINDOWPLACEMENT) bool {
	ret, _, _ := setWindowPlacement.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(placement)),
	)
	return ret != 0
}

func ShowCursor(show bool) int {
	ret, _, _ := showCursor.Call(uintptr(BoolToBOOL(show)))
	return int(ret)
}

func LoadImage(
	inst HINSTANCE,
	name *uint16,
	typ uint,
	desiredWidth, desiredHeight int,
	load uint,
) HANDLE {
	ret, _, _ := loadImage.Call(
		uintptr(inst),
		uintptr(unsafe.Pointer(name)),
		uintptr(typ),
		uintptr(desiredWidth),
		uintptr(desiredHeight),
		uintptr(load),
	)
	return HANDLE(ret)
}

func GetForegroundWindow() HWND {
	ret, _, _ := getForegroundWindow.Call()
	return HWND(ret)
}

func FindWindow(className, windowName string) HWND {
	var class, window uintptr
	if className != "" {
		class = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(className)))
	}
	if windowName != "" {
		window = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(windowName)))
	}
	ret, _, _ := findWindow.Call(class, window)
	return HWND(ret)
}

func GetClassName(window HWND) (string, bool) {
	var output [256]uint16
	ret, _, _ := getClassName.Call(
		uintptr(window),
		uintptr(unsafe.Pointer(&output[0])),
		uintptr(len(output)),
	)
	return syscall.UTF16ToString(output[:]), ret != 0
}

func GetMenu(window HWND) HMENU {
	ret, _, _ := getMenu.Call(uintptr(window))
	return HMENU(ret)
}

func GetSubMenu(menu HMENU, pos int) HMENU {
	ret, _, _ := getSubMenu.Call(uintptr(menu), uintptr(pos))
	return HMENU(ret)
}

func CheckMenuItem(menu HMENU, idCheckItem, check uint) int32 {
	ret, _, _ := checkMenuItem.Call(
		uintptr(menu),
		uintptr(idCheckItem),
		uintptr(check),
	)
	return int32(ret)
}

func GetDesktopWindow() HWND {
	ret, _, _ := getDesktopWindow.Call()
	return HWND(ret)
}

func GetRawInputData(input HRAWINPUT, command uint) (raw RAWINPUT, ok bool) {
	size := uint(unsafe.Sizeof(raw))
	ret, _, _ := getRawInputData.Call(
		uintptr(input),
		uintptr(command),
		uintptr(unsafe.Pointer(&raw)),
		uintptr(unsafe.Pointer(&size)),
		unsafe.Sizeof(raw.Header),
	)
	var fail uint32
	fail--
	ok = uint32(ret) != fail
	return
}

func RegisterRawInputDevices(devices ...RAWINPUTDEVICE) bool {
	if len(devices) == 0 {
		return true
	}
	ret, _, _ := registerRawInputDevices.Call(
		uintptr(unsafe.Pointer(&devices[0])),
		uintptr(len(devices)),
		unsafe.Sizeof(devices[0]),
	)
	return ret != 0
}

func SetTimer(window HWND, idEvent uintptr, elapse uint, timerFunc uintptr) uintptr {
	ret, _, _ := setTimer.Call(
		uintptr(window),
		idEvent,
		uintptr(elapse),
		timerFunc,
	)
	return ret
}

func GetActiveWindow() HWND {
	ret, _, _ := getActiveWindow.Call()
	return HWND(ret)
}

func MessageBeep(typ uint) bool {
	ret, _, _ := messageBeep.Call(uintptr(typ))
	return ret != 0
}

// GetCaretBlinkTime returns the time required to invert the caret's pixels, in
// milliseconds. If the number is negative, the time is infinite and thus the
// cursor does not blink.
func GetCaretBlinkTime() int {
	ret, _, _ := getCaretBlinkTime.Call()
	return int(int32(ret))
}

func GetWindowDC(window HWND) HDC {
	ret, _, _ := getWindowDC.Call(uintptr(window))
	return HDC(ret)
}

func EnumWindows(callback func(window HWND)) bool {
	f := syscall.NewCallback(func(w, _ uintptr) {
		callback(HWND(w))
	})
	ret, _, _ := enumWindows.Call(f, 0)
	return ret != 0
}

func GetTopWindow(of HWND) HWND {
	ret, _, _ := getTopWindow.Call(uintptr(of))
	return HWND(ret)
}

func GetWindow(rel HWND, cmd uint) HWND {
	ret, _, _ := getWindow.Call(uintptr(rel), uintptr(cmd))
	return HWND(ret)
}

func GetNextWindow(rel HWND, cmd uint) HWND {
	return GetWindow(rel, cmd)
}

func GetKeyState(key int) uint16 {
	ret, _, _ := getKeyState.Call(uintptr(key))
	return uint16(ret)
}

func RegCreateKey(hKey HKEY, subKey string) HKEY {
	var result HKEY
	ret, _, _ := regCreateKeyEx.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(0),
		uintptr(0),
		uintptr(0),
		uintptr(KEY_ALL_ACCESS),
		uintptr(0),
		uintptr(unsafe.Pointer(&result)),
		uintptr(0))
	_ = ret
	return result
}

func RegOpenKeyEx(hKey HKEY, subKey string, samDesired uint32) HKEY {
	var result HKEY
	ret, _, _ := regOpenKeyEx.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(0),
		uintptr(samDesired),
		uintptr(unsafe.Pointer(&result)))
	if ret != ERROR_SUCCESS {
		return 0
	}
	return result
}

func RegCloseKey(hKey HKEY) error {
	var err error
	ret, _, _ := regCloseKey.Call(
		uintptr(hKey))

	if ret != ERROR_SUCCESS {
		err = errors.New("RegCloseKey failed")
	}
	return err
}

func RegGetRaw(hKey HKEY, subKey string, value string) []byte {
	var bufLen uint32
	var valptr unsafe.Pointer
	if len(value) > 0 {
		valptr = unsafe.Pointer(syscall.StringToUTF16Ptr(value))
	}
	regGetValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(valptr),
		uintptr(RRF_RT_ANY),
		0,
		0,
		uintptr(unsafe.Pointer(&bufLen)),
	)

	if bufLen == 0 {
		return nil
	}

	buf := make([]byte, bufLen)
	ret, _, _ := regGetValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(valptr),
		uintptr(RRF_RT_ANY),
		0,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&bufLen)),
	)

	if ret != ERROR_SUCCESS {
		return nil
	}

	return buf
}

func RegSetBinary(hKey HKEY, subKey string, value []byte) (errno int) {
	var lptr, vptr unsafe.Pointer
	if len(subKey) > 0 {
		lptr = unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))
	}
	if len(value) > 0 {
		vptr = unsafe.Pointer(&value[0])
	}
	ret, _, _ := regSetValueEx.Call(
		uintptr(hKey),
		uintptr(lptr),
		uintptr(0),
		uintptr(REG_BINARY),
		uintptr(vptr),
		uintptr(len(value)),
	)
	return int(ret)
}

func RegSetString(hKey HKEY, subKey string, value string) (errno int) {
	var lptr, vptr unsafe.Pointer
	if subKey != "" {
		lptr = unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))
	}
	var dataLength int
	if value != "" {
		buf, err := syscall.UTF16FromString(value)
		if err != nil {
			return ERROR_BAD_FORMAT
		}
		vptr = unsafe.Pointer(&buf[0])
		dataLength = len(buf) * 2
	}
	ret, _, _ := regSetValueEx.Call(
		uintptr(hKey),
		uintptr(lptr),
		uintptr(0),
		uintptr(REG_SZ),
		uintptr(vptr),
		uintptr(dataLength),
	)
	return int(ret)
}

func RegSetUint32(hKey HKEY, subKey string, value uint32) (errno int) {
	var lptr unsafe.Pointer
	if len(subKey) > 0 {
		lptr = unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))
	}
	vptr := unsafe.Pointer(&value)
	ret, _, _ := regSetValueEx.Call(
		uintptr(hKey),
		uintptr(lptr),
		uintptr(0),
		uintptr(REG_DWORD),
		uintptr(vptr),
		uintptr(unsafe.Sizeof(value)),
	)
	return int(ret)
}

func RegGetString(hKey HKEY, subKey string, value string) string {
	var bufLen uint32
	regGetValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(value))),
		uintptr(RRF_RT_REG_SZ),
		0,
		0,
		uintptr(unsafe.Pointer(&bufLen)),
	)

	if bufLen == 0 {
		return ""
	}

	buf := make([]uint16, bufLen)
	ret, _, _ := regGetValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(value))),
		uintptr(RRF_RT_REG_SZ),
		0,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&bufLen)),
	)

	if ret != ERROR_SUCCESS {
		return ""
	}

	return syscall.UTF16ToString(buf)
}

func RegGetUint32(hKey HKEY, subKey string, value string) (data uint32, errno int) {
	var dataLen uint32 = uint32(unsafe.Sizeof(data))
	ret, _, _ := regGetValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(value))),
		uintptr(RRF_RT_REG_DWORD),
		0,
		uintptr(unsafe.Pointer(&data)),
		uintptr(unsafe.Pointer(&dataLen)),
	)
	errno = int(ret)
	return
}

func RegDeleteKeyValue(hKey HKEY, subKey string, valueName string) (errno int) {
	ret, _, _ := regDeleteKeyValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(valueName))),
	)
	return int(ret)
}

func RegDeleteValue(hKey HKEY, valueName string) (errno int) {
	ret, _, _ := regDeleteValue.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(valueName))),
	)
	return int(ret)
}

func RegDeleteTree(hKey HKEY, subKey string) (errno int) {
	ret, _, _ := regDeleteTree.Call(
		uintptr(hKey),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(subKey))),
	)
	return int(ret)
}

func RegEnumKeyEx(hKey HKEY, index uint32) string {
	var bufLen uint32 = 255
	buf := make([]uint16, bufLen)
	regEnumKeyEx.Call(
		uintptr(hKey),
		uintptr(index),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&bufLen)),
		0,
		0,
		0,
		0,
	)
	return syscall.UTF16ToString(buf)
}

func OpenEventLog(servername string, sourcename string) HANDLE {
	ret, _, _ := openEventLog.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(servername))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(sourcename))),
	)
	return HANDLE(ret)
}

func ReadEventLog(eventlog HANDLE, readflags, recordoffset uint32, buffer []byte, numberofbytestoread uint32, bytesread, minnumberofbytesneeded *uint32) bool {
	ret, _, _ := readEventLog.Call(
		uintptr(eventlog),
		uintptr(readflags),
		uintptr(recordoffset),
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(numberofbytestoread),
		uintptr(unsafe.Pointer(bytesread)),
		uintptr(unsafe.Pointer(minnumberofbytesneeded)),
	)
	return ret != 0
}

func CloseEventLog(eventlog HANDLE) bool {
	ret, _, _ := closeEventLog.Call(uintptr(eventlog))
	return ret != 0
}

func OpenSCManager(lpMachineName, lpDatabaseName string, dwDesiredAccess uint32) (HANDLE, error) {
	var p1, p2 uintptr
	if len(lpMachineName) > 0 {
		p1 = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpMachineName)))
	}
	if len(lpDatabaseName) > 0 {
		p2 = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpDatabaseName)))
	}
	ret, _, _ := openSCManager.Call(
		p1,
		p2,
		uintptr(dwDesiredAccess))

	if ret == 0 {
		return 0, syscall.GetLastError()
	}
	return HANDLE(ret), nil
}

func CloseServiceHandle(hSCObject HANDLE) error {
	ret, _, _ := closeServiceHandle.Call(uintptr(hSCObject))
	if ret == 0 {
		return syscall.GetLastError()
	}
	return nil
}

func OpenService(hSCManager HANDLE, lpServiceName string, dwDesiredAccess uint32) (HANDLE, error) {
	ret, _, _ := openService.Call(
		uintptr(hSCManager),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpServiceName))),
		uintptr(dwDesiredAccess),
	)

	if ret == 0 {
		return 0, syscall.GetLastError()
	}

	return HANDLE(ret), nil
}

func StartService(hService HANDLE, lpServiceArgVectors []string) error {
	l := len(lpServiceArgVectors)
	var ret uintptr
	if l == 0 {
		ret, _, _ = startService.Call(
			uintptr(hService),
			0,
			0,
		)
	} else {
		lpArgs := make([]uintptr, l)
		for i := 0; i < l; i++ {
			lpArgs[i] = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpServiceArgVectors[i])))
		}

		ret, _, _ = startService.Call(
			uintptr(hService),
			uintptr(l),
			uintptr(unsafe.Pointer(&lpArgs[0])),
		)
	}

	if ret == 0 {
		return syscall.GetLastError()
	}

	return nil
}

func ControlService(hService HANDLE, dwControl uint32, lpServiceStatus *SERVICE_STATUS) bool {
	if lpServiceStatus == nil {
		panic("ControlService: lpServiceStatus cannot be nil")
	}
	ret, _, _ := controlService.Call(
		uintptr(hService),
		uintptr(dwControl),
		uintptr(unsafe.Pointer(lpServiceStatus)),
	)
	return ret != 0
}

func InitCommonControlsEx(lpInitCtrls *INITCOMMONCONTROLSEX) bool {
	ret, _, _ := initCommonControlsEx.Call(uintptr(unsafe.Pointer(lpInitCtrls)))
	return ret != 0
}

func ImageList_Create(cx, cy int, flags uint, cInitial, cGrow int) HIMAGELIST {
	ret, _, _ := imageList_Create.Call(
		uintptr(cx),
		uintptr(cy),
		uintptr(flags),
		uintptr(cInitial),
		uintptr(cGrow),
	)
	return HIMAGELIST(ret)
}

func ImageList_Destroy(himl HIMAGELIST) bool {
	ret, _, _ := imageList_Destroy.Call(uintptr(himl))
	return ret != 0
}

func ImageList_GetImageCount(himl HIMAGELIST) int {
	ret, _, _ := imageList_GetImageCount.Call(uintptr(himl))
	return int(ret)
}

func ImageList_SetImageCount(himl HIMAGELIST, uNewCount uint) bool {
	ret, _, _ := imageList_SetImageCount.Call(
		uintptr(himl),
		uintptr(uNewCount),
	)
	return ret != 0
}

func ImageList_Add(himl HIMAGELIST, hbmImage, hbmMask HBITMAP) int {
	ret, _, _ := imageList_Add.Call(
		uintptr(himl),
		uintptr(hbmImage),
		uintptr(hbmMask),
	)
	return int(ret)
}

func ImageList_ReplaceIcon(himl HIMAGELIST, i int, hicon HICON) int {
	ret, _, _ := imageList_ReplaceIcon.Call(
		uintptr(himl),
		uintptr(i),
		uintptr(hicon),
	)
	return int(ret)
}

func ImageList_AddIcon(himl HIMAGELIST, hicon HICON) int {
	return ImageList_ReplaceIcon(himl, -1, hicon)
}

func ImageList_Remove(himl HIMAGELIST, i int) bool {
	ret, _, _ := imageList_Remove.Call(
		uintptr(himl),
		uintptr(i),
	)
	return ret != 0
}

func ImageList_RemoveAll(himl HIMAGELIST) bool {
	return ImageList_Remove(himl, -1)
}

func TrackMouseEvent(tme *TRACKMOUSEEVENT) bool {
	ret, _, _ := trackMouseEvent.Call(uintptr(unsafe.Pointer(tme)))
	return ret != 0
}

// GetOpenFileName automatically sets the StructSize member of the OPENFILENAME.
func GetOpenFileName(ofn *OPENFILENAME) bool {
	if ofn != nil {
		ofn.StructSize = uint32(unsafe.Sizeof(*ofn))
	}
	ret, _, _ := getOpenFileName.Call(uintptr(unsafe.Pointer(ofn)))
	return ret != 0
}

func GetSaveFileName(ofn *OPENFILENAME) bool {
	ret, _, _ := getSaveFileName.Call(uintptr(unsafe.Pointer(ofn)))
	return ret != 0
}

func CommDlgExtendedError() uint {
	ret, _, _ := commDlgExtendedError.Call()
	return uint(ret)
}

func DwmDefWindowProc(hWnd HWND, msg uint, wParam, lParam uintptr) (bool, uint) {
	var result uint
	ret, _, _ := dwmDefWindowProc.Call(
		uintptr(hWnd),
		uintptr(msg),
		wParam,
		lParam,
		uintptr(unsafe.Pointer(&result)),
	)
	return ret != 0, result
}

func DwmEnableBlurBehindWindow(hWnd HWND, pBlurBehind *DWM_BLURBEHIND) HRESULT {
	ret, _, _ := dwmEnableBlurBehindWindow.Call(
		uintptr(hWnd),
		uintptr(unsafe.Pointer(pBlurBehind)),
	)
	return HRESULT(ret)
}

func DwmEnableMMCSS(fEnableMMCSS bool) HRESULT {
	ret, _, _ := dwmEnableMMCSS.Call(uintptr(BoolToBOOL(fEnableMMCSS)))
	return HRESULT(ret)
}

func DwmExtendFrameIntoClientArea(hWnd HWND, pMarInset *MARGINS) HRESULT {
	ret, _, _ := dwmExtendFrameIntoClientArea.Call(
		uintptr(hWnd),
		uintptr(unsafe.Pointer(pMarInset)),
	)
	return HRESULT(ret)
}

func DwmFlush() HRESULT {
	ret, _, _ := dwmFlush.Call()
	return HRESULT(ret)
}

func DwmGetColorizationColor(pcrColorization *uint32, pfOpaqueBlend *BOOL) HRESULT {
	ret, _, _ := dwmGetColorizationColor.Call(
		uintptr(unsafe.Pointer(pcrColorization)),
		uintptr(unsafe.Pointer(pfOpaqueBlend)),
	)
	return HRESULT(ret)
}

func DwmGetCompositionTimingInfo(hWnd HWND, pTimingInfo *DWM_TIMING_INFO) HRESULT {
	ret, _, _ := dwmGetCompositionTimingInfo.Call(
		uintptr(hWnd),
		uintptr(unsafe.Pointer(pTimingInfo)),
	)
	return HRESULT(ret)
}

func DwmGetTransportAttributes(pfIsRemoting *BOOL, pfIsConnected *BOOL, pDwGeneration *uint32) HRESULT {
	ret, _, _ := dwmGetTransportAttributes.Call(
		uintptr(unsafe.Pointer(pfIsRemoting)),
		uintptr(unsafe.Pointer(pfIsConnected)),
		uintptr(unsafe.Pointer(pDwGeneration)),
	)
	return HRESULT(ret)
}

// TODO: verify handling of variable arguments
func DwmGetWindowAttribute(hWnd HWND, dwAttribute uint32) (pAttribute interface{}, result HRESULT) {
	var pvAttribute, pvAttrSize uintptr
	switch dwAttribute {
	case DWMWA_NCRENDERING_ENABLED:
		v := new(BOOL)
		pAttribute = v
		pvAttribute = uintptr(unsafe.Pointer(v))
		pvAttrSize = unsafe.Sizeof(*v)
	case DWMWA_CAPTION_BUTTON_BOUNDS, DWMWA_EXTENDED_FRAME_BOUNDS:
		v := new(RECT)
		pAttribute = v
		pvAttribute = uintptr(unsafe.Pointer(v))
		pvAttrSize = unsafe.Sizeof(*v)
	case DWMWA_CLOAKED:
		panic(fmt.Sprintf("DwmGetWindowAttribute(%d) is not currently supported.", dwAttribute))
	default:
		panic(fmt.Sprintf("DwmGetWindowAttribute(%d) is not valid.", dwAttribute))
	}

	ret, _, _ := dwmGetWindowAttribute.Call(
		uintptr(hWnd),
		uintptr(dwAttribute),
		pvAttribute,
		pvAttrSize,
	)
	result = HRESULT(ret)
	return
}

func DwmInvalidateIconicBitmaps(hWnd HWND) HRESULT {
	ret, _, _ := dwmInvalidateIconicBitmaps.Call(uintptr(hWnd))
	return HRESULT(ret)
}

func DwmIsCompositionEnabled(pfEnabled *BOOL) HRESULT {
	ret, _, _ := dwmIsCompositionEnabled.Call(uintptr(unsafe.Pointer(pfEnabled)))
	return HRESULT(ret)
}

func DwmModifyPreviousDxFrameDuration(hWnd HWND, cRefreshes int, fRelative bool) HRESULT {
	ret, _, _ := dwmModifyPreviousDxFrameDuration.Call(
		uintptr(hWnd),
		uintptr(cRefreshes),
		uintptr(BoolToBOOL(fRelative)),
	)
	return HRESULT(ret)
}

func DwmQueryThumbnailSourceSize(hThumbnail HTHUMBNAIL, pSize *SIZE) HRESULT {
	ret, _, _ := dwmQueryThumbnailSourceSize.Call(
		uintptr(hThumbnail),
		uintptr(unsafe.Pointer(pSize)),
	)
	return HRESULT(ret)
}

func DwmRegisterThumbnail(hWndDestination HWND, hWndSource HWND, phThumbnailId *HTHUMBNAIL) HRESULT {
	ret, _, _ := dwmRegisterThumbnail.Call(
		uintptr(hWndDestination),
		uintptr(hWndSource),
		uintptr(unsafe.Pointer(phThumbnailId)),
	)
	return HRESULT(ret)
}

func DwmRenderGesture(gt GESTURE_TYPE, cContacts uint, pdwPointerID *uint32, pPoints *POINT) {
	dwmRenderGesture.Call(
		uintptr(gt),
		uintptr(cContacts),
		uintptr(unsafe.Pointer(pdwPointerID)),
		uintptr(unsafe.Pointer(pPoints)),
	)
	return
}

func DwmSetDxFrameDuration(hWnd HWND, cRefreshes int) HRESULT {
	ret, _, _ := dwmSetDxFrameDuration.Call(
		uintptr(hWnd),
		uintptr(cRefreshes),
	)
	return HRESULT(ret)
}

func DwmSetIconicLivePreviewBitmap(hWnd HWND, hbmp HBITMAP, pptClient *POINT, dwSITFlags uint32) HRESULT {
	ret, _, _ := dwmSetIconicLivePreviewBitmap.Call(
		uintptr(hWnd),
		uintptr(hbmp),
		uintptr(unsafe.Pointer(pptClient)),
		uintptr(dwSITFlags),
	)
	return HRESULT(ret)
}

func DwmSetIconicThumbnail(hWnd HWND, hbmp HBITMAP, dwSITFlags uint32) HRESULT {
	ret, _, _ := dwmSetIconicThumbnail.Call(
		uintptr(hWnd),
		uintptr(hbmp),
		uintptr(dwSITFlags),
	)
	return HRESULT(ret)
}

func DwmSetPresentParameters(hWnd HWND, pPresentParams *DWM_PRESENT_PARAMETERS) HRESULT {
	ret, _, _ := dwmSetPresentParameters.Call(
		uintptr(hWnd),
		uintptr(unsafe.Pointer(pPresentParams)),
	)
	return HRESULT(ret)
}

func DwmSetWindowAttribute(hWnd HWND, dwAttribute uint32, pvAttribute LPCVOID, cbAttribute uint32) HRESULT {
	ret, _, _ := dwmSetWindowAttribute.Call(
		uintptr(hWnd),
		uintptr(dwAttribute),
		uintptr(pvAttribute),
		uintptr(cbAttribute),
	)
	return HRESULT(ret)
}

func DwmShowContact(dwPointerID uint32, eShowContact DWM_SHOWCONTACT) {
	dwmShowContact.Call(
		uintptr(dwPointerID),
		uintptr(eShowContact),
	)
	return
}

func DwmTetherContact(dwPointerID uint32, fEnable bool, ptTether POINT) {
	dwmTetherContact.Call(
		uintptr(dwPointerID),
		uintptr(BoolToBOOL(fEnable)),
		uintptr(unsafe.Pointer(&ptTether)),
	)
	return
}

func DwmTransitionOwnedWindow(hWnd HWND, target DWMTRANSITION_OWNEDWINDOW_TARGET) {
	dwmTransitionOwnedWindow.Call(
		uintptr(hWnd),
		uintptr(target),
	)
	return
}

func DwmUnregisterThumbnail(hThumbnailId HTHUMBNAIL) HRESULT {
	ret, _, _ := dwmUnregisterThumbnail.Call(uintptr(hThumbnailId))
	return HRESULT(ret)
}

func DwmUpdateThumbnailProperties(hThumbnailId HTHUMBNAIL, ptnProperties *DWM_THUMBNAIL_PROPERTIES) HRESULT {
	ret, _, _ := dwmUpdateThumbnailProperties.Call(
		uintptr(hThumbnailId),
		uintptr(unsafe.Pointer(ptnProperties)),
	)
	return HRESULT(ret)
}

func GetDeviceCaps(hdc HDC, index int) int {
	ret, _, _ := getDeviceCaps.Call(
		uintptr(hdc),
		uintptr(index),
	)
	return int(ret)
}

func DeleteObject(hObject HGDIOBJ) bool {
	ret, _, _ := deleteObject.Call(uintptr(hObject))
	return ret != 0
}

func CreateFontIndirect(logFont *LOGFONT) HFONT {
	ret, _, _ := createFontIndirect.Call(uintptr(unsafe.Pointer(logFont)))
	return HFONT(ret)
}

func AbortDoc(hdc HDC) int {
	ret, _, _ := abortDoc.Call(uintptr(hdc))
	return int(ret)
}

func BitBlt(hdcDest HDC, nXDest, nYDest, nWidth, nHeight int, hdcSrc HDC, nXSrc, nYSrc int, dwRop uint) bool {
	ret, _, _ := bitBlt.Call(
		uintptr(hdcDest),
		uintptr(nXDest),
		uintptr(nYDest),
		uintptr(nWidth),
		uintptr(nHeight),
		uintptr(hdcSrc),
		uintptr(nXSrc),
		uintptr(nYSrc),
		uintptr(dwRop),
	)
	return ret != 0
}

func PatBlt(hdc HDC, nXLeft, nYLeft, nWidth, nHeight int, dwRop uint) bool {
	ret, _, _ := patBlt.Call(
		uintptr(hdc),
		uintptr(nXLeft),
		uintptr(nYLeft),
		uintptr(nWidth),
		uintptr(nHeight),
		uintptr(dwRop),
	)
	return ret != 0
}

func CloseEnhMetaFile(hdc HDC) HENHMETAFILE {
	ret, _, _ := closeEnhMetaFile.Call(uintptr(hdc))
	return HENHMETAFILE(ret)
}

func CopyEnhMetaFile(hemfSrc HENHMETAFILE, lpszFile *uint16) HENHMETAFILE {
	ret, _, _ := copyEnhMetaFile.Call(
		uintptr(hemfSrc),
		uintptr(unsafe.Pointer(lpszFile)),
	)
	return HENHMETAFILE(ret)
}

func CreateBrushIndirect(lplb *LOGBRUSH) HBRUSH {
	ret, _, _ := createBrushIndirect.Call(uintptr(unsafe.Pointer(lplb)))
	return HBRUSH(ret)
}

func CreateCompatibleDC(hdc HDC) HDC {
	ret, _, _ := createCompatibleDC.Call(uintptr(hdc))
	return HDC(ret)
}

func CreateCompatibleBitmap(hdc HDC, width, height int) HBITMAP {
	ret, _, _ := createCompatibleBitmap.Call(
		uintptr(hdc),
		uintptr(width),
		uintptr(height),
	)
	return HBITMAP(ret)
}

func CreateDC(lpszDriver, lpszDevice, lpszOutput *uint16, lpInitData *DEVMODE) HDC {
	ret, _, _ := createDC.Call(
		uintptr(unsafe.Pointer(lpszDriver)),
		uintptr(unsafe.Pointer(lpszDevice)),
		uintptr(unsafe.Pointer(lpszOutput)),
		uintptr(unsafe.Pointer(lpInitData)),
	)
	return HDC(ret)
}

func CreateDIBSection(hdc HDC, pbmi *BITMAPINFO, iUsage uint, ppvBits *unsafe.Pointer, hSection HANDLE, dwOffset uint) HBITMAP {
	ret, _, _ := createDIBSection.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(pbmi)),
		uintptr(iUsage),
		uintptr(unsafe.Pointer(ppvBits)),
		uintptr(hSection),
		uintptr(dwOffset),
	)
	return HBITMAP(ret)
}

func CreateEnhMetaFile(hdcRef HDC, lpFilename *uint16, lpRect *RECT, lpDescription *uint16) HDC {
	ret, _, _ := createEnhMetaFile.Call(
		uintptr(hdcRef),
		uintptr(unsafe.Pointer(lpFilename)),
		uintptr(unsafe.Pointer(lpRect)),
		uintptr(unsafe.Pointer(lpDescription)),
	)
	return HDC(ret)
}

func CreateIC(lpszDriver, lpszDevice, lpszOutput *uint16, lpdvmInit *DEVMODE) HDC {
	ret, _, _ := createIC.Call(
		uintptr(unsafe.Pointer(lpszDriver)),
		uintptr(unsafe.Pointer(lpszDevice)),
		uintptr(unsafe.Pointer(lpszOutput)),
		uintptr(unsafe.Pointer(lpdvmInit)),
	)
	return HDC(ret)
}

func DeleteDC(hdc HDC) bool {
	ret, _, _ := deleteDC.Call(uintptr(hdc))
	return ret != 0
}

func DeleteEnhMetaFile(hemf HENHMETAFILE) bool {
	ret, _, _ := deleteEnhMetaFile.Call(uintptr(hemf))
	return ret != 0
}

func Ellipse(hdc HDC, nLeftRect, nTopRect, nRightRect, nBottomRect int) bool {
	ret, _, _ := ellipse.Call(
		uintptr(hdc),
		uintptr(nLeftRect),
		uintptr(nTopRect),
		uintptr(nRightRect),
		uintptr(nBottomRect),
	)
	return ret != 0
}

func EndDoc(hdc HDC) int {
	ret, _, _ := endDoc.Call(uintptr(hdc))
	return int(ret)
}

func EndPage(hdc HDC) int {
	ret, _, _ := endPage.Call(uintptr(hdc))
	return int(ret)
}

func ExtCreatePen(dwPenStyle, dwWidth uint, lplb *LOGBRUSH, dwStyleCount uint, lpStyle *uint) HPEN {
	ret, _, _ := extCreatePen.Call(
		uintptr(dwPenStyle),
		uintptr(dwWidth),
		uintptr(unsafe.Pointer(lplb)),
		uintptr(dwStyleCount),
		uintptr(unsafe.Pointer(lpStyle)),
	)
	return HPEN(ret)
}

func GetEnhMetaFile(lpszMetaFile *uint16) HENHMETAFILE {
	ret, _, _ := getEnhMetaFile.Call(uintptr(unsafe.Pointer(lpszMetaFile)))
	return HENHMETAFILE(ret)
}

func GetEnhMetaFileHeader(hemf HENHMETAFILE, cbBuffer uint, lpemh *ENHMETAHEADER) uint {
	ret, _, _ := getEnhMetaFileHeader.Call(
		uintptr(hemf),
		uintptr(cbBuffer),
		uintptr(unsafe.Pointer(lpemh)),
	)
	return uint(ret)
}

func GetObject(hgdiobj HGDIOBJ, cbBuffer uintptr, lpvObject unsafe.Pointer) int {
	ret, _, _ := getObject.Call(
		uintptr(hgdiobj),
		uintptr(cbBuffer),
		uintptr(lpvObject),
	)
	return int(ret)
}

func GetStockObject(fnObject int) HGDIOBJ {
	ret, _, _ := getDeviceCaps.Call(uintptr(fnObject))
	return HGDIOBJ(ret)
}

func GetTextExtentExPoint(hdc HDC, lpszStr *uint16, cchString, nMaxExtent int, lpnFit, alpDx *int, lpSize *SIZE) bool {
	ret, _, _ := getTextExtentExPoint.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(lpszStr)),
		uintptr(cchString),
		uintptr(nMaxExtent),
		uintptr(unsafe.Pointer(lpnFit)),
		uintptr(unsafe.Pointer(alpDx)),
		uintptr(unsafe.Pointer(lpSize)),
	)
	return ret != 0
}

func GetTextExtentPoint32(hdc HDC, lpString *uint16, c int, lpSize *SIZE) bool {
	ret, _, _ := getTextExtentPoint32.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(lpString)),
		uintptr(c),
		uintptr(unsafe.Pointer(lpSize)),
	)
	return ret != 0
}

func GetTextMetrics(hdc HDC, lptm *TEXTMETRIC) bool {
	ret, _, _ := getTextMetrics.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(lptm)),
	)
	return ret != 0
}

func LineTo(hdc HDC, nXEnd, nYEnd int) bool {
	ret, _, _ := lineTo.Call(
		uintptr(hdc),
		uintptr(nXEnd),
		uintptr(nYEnd),
	)
	return ret != 0
}

func MoveToEx(hdc HDC, x, y int, lpPoint *POINT) bool {
	ret, _, _ := moveToEx.Call(
		uintptr(hdc),
		uintptr(x),
		uintptr(y),
		uintptr(unsafe.Pointer(lpPoint)),
	)
	return ret != 0
}

func PlayEnhMetaFile(hdc HDC, hemf HENHMETAFILE, lpRect *RECT) bool {
	ret, _, _ := playEnhMetaFile.Call(
		uintptr(hdc),
		uintptr(hemf),
		uintptr(unsafe.Pointer(lpRect)),
	)
	return ret != 0
}

func Rectangle(hdc HDC, nLeftRect, nTopRect, nRightRect, nBottomRect int) bool {
	ret, _, _ := rectangle.Call(
		uintptr(hdc),
		uintptr(nLeftRect),
		uintptr(nTopRect),
		uintptr(nRightRect),
		uintptr(nBottomRect),
	)
	return ret != 0
}

func ResetDC(hdc HDC, lpInitData *DEVMODE) HDC {
	ret, _, _ := resetDC.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(lpInitData)),
	)
	return HDC(ret)
}

func SelectObject(hdc HDC, hgdiobj HGDIOBJ) HGDIOBJ {
	ret, _, _ := selectObject.Call(
		uintptr(hdc),
		uintptr(hgdiobj),
	)
	return HGDIOBJ(ret)
}

func SetBkMode(hdc HDC, iBkMode int) int {
	ret, _, _ := setBkMode.Call(
		uintptr(hdc),
		uintptr(iBkMode),
	)
	return int(ret)
}

func SetBrushOrgEx(hdc HDC, nXOrg, nYOrg int, lppt *POINT) bool {
	ret, _, _ := setBrushOrgEx.Call(
		uintptr(hdc),
		uintptr(nXOrg),
		uintptr(nYOrg),
		uintptr(unsafe.Pointer(lppt)),
	)
	return ret != 0
}

func SetStretchBltMode(hdc HDC, iStretchMode int) int {
	ret, _, _ := setStretchBltMode.Call(
		uintptr(hdc),
		uintptr(iStretchMode),
	)
	return int(ret)
}

func SetTextColor(hdc HDC, crColor COLORREF) COLORREF {
	ret, _, _ := setTextColor.Call(
		uintptr(hdc),
		uintptr(crColor),
	)
	return COLORREF(ret)
}

func SetBkColor(hdc HDC, crColor COLORREF) COLORREF {
	ret, _, _ := setBkColor.Call(
		uintptr(hdc),
		uintptr(crColor),
	)
	return COLORREF(ret)
}

func StartDoc(hdc HDC, lpdi *DOCINFO) int {
	ret, _, _ := startDoc.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(lpdi)),
	)
	return int(ret)
}

func StartPage(hdc HDC) int {
	ret, _, _ := startPage.Call(uintptr(hdc))
	return int(ret)
}

func StretchBlt(hdcDest HDC, nXOriginDest, nYOriginDest, nWidthDest, nHeightDest int, hdcSrc HDC, nXOriginSrc, nYOriginSrc, nWidthSrc, nHeightSrc int, dwRop uint) bool {
	ret, _, _ := stretchBlt.Call(
		uintptr(hdcDest),
		uintptr(nXOriginDest),
		uintptr(nYOriginDest),
		uintptr(nWidthDest),
		uintptr(nHeightDest),
		uintptr(hdcSrc),
		uintptr(nXOriginSrc),
		uintptr(nYOriginSrc),
		uintptr(nWidthSrc),
		uintptr(nHeightSrc),
		uintptr(dwRop),
	)
	return ret != 0
}

func SetDIBitsToDevice(hdc HDC, xDest, yDest, dwWidth, dwHeight, xSrc, ySrc int, uStartScan, cScanLines uint, lpvBits []byte, lpbmi *BITMAPINFO, fuColorUse uint) int {
	ret, _, _ := setDIBitsToDevice.Call(
		uintptr(hdc),
		uintptr(xDest),
		uintptr(yDest),
		uintptr(dwWidth),
		uintptr(dwHeight),
		uintptr(xSrc),
		uintptr(ySrc),
		uintptr(uStartScan),
		uintptr(cScanLines),
		uintptr(unsafe.Pointer(&lpvBits[0])),
		uintptr(unsafe.Pointer(lpbmi)),
		uintptr(fuColorUse),
	)
	return int(ret)
}

func ChoosePixelFormat(hdc HDC, pfd *PIXELFORMATDESCRIPTOR) int {
	ret, _, _ := choosePixelFormat.Call(
		uintptr(hdc),
		uintptr(unsafe.Pointer(pfd)),
	)
	return int(ret)
}

func DescribePixelFormat(hdc HDC, iPixelFormat int, nBytes uint, pfd *PIXELFORMATDESCRIPTOR) int {
	ret, _, _ := describePixelFormat.Call(
		uintptr(hdc),
		uintptr(iPixelFormat),
		uintptr(nBytes),
		uintptr(unsafe.Pointer(pfd)),
	)
	return int(ret)
}

func GetEnhMetaFilePixelFormat(hemf HENHMETAFILE, cbBuffer uint32, pfd *PIXELFORMATDESCRIPTOR) uint {
	ret, _, _ := getEnhMetaFilePixelFormat.Call(
		uintptr(hemf),
		uintptr(cbBuffer),
		uintptr(unsafe.Pointer(pfd)),
	)
	return uint(ret)
}

func GetPixelFormat(hdc HDC) int {
	ret, _, _ := getPixelFormat.Call(uintptr(hdc))
	return int(ret)
}

func SetPixelFormat(hdc HDC, iPixelFormat int, pfd *PIXELFORMATDESCRIPTOR) bool {
	ret, _, _ := setPixelFormat.Call(
		uintptr(hdc),
		uintptr(iPixelFormat),
		uintptr(unsafe.Pointer(pfd)),
	)
	return ret == TRUE
}

func SwapBuffers(hdc HDC) bool {
	ret, _, _ := swapBuffers.Call(uintptr(hdc))
	return ret == TRUE
}

func TextOut(hdc HDC, x, y int, s string) bool {
	str, err := syscall.UTF16FromString(s)
	if err != nil {
		return false
	}
	ret, _, _ := textOut.Call(
		uintptr(hdc),
		uintptr(x),
		uintptr(y),
		uintptr(unsafe.Pointer(&str[0])),
		uintptr(len(str)),
	)
	return ret != 0
}

func CreateSolidBrush(color uint32) HBRUSH {
	ret, _, _ := createSolidBrush.Call(uintptr(color))
	return HBRUSH(ret)
}

func GetDIBits(
	dc HDC,
	bmp HBITMAP,
	startScan, scanLines uint,
	bits unsafe.Pointer,
	info *BITMAPINFO,
	usage uint,
) int {
	ret, _, _ := getDIBits.Call(
		uintptr(dc),
		uintptr(bmp),
		uintptr(startScan),
		uintptr(scanLines),
		uintptr(bits),
		uintptr(unsafe.Pointer(info)),
		uintptr(usage),
	)
	return int(ret)
}

func GetModuleHandle(modulename string) HINSTANCE {
	var mn uintptr
	if modulename == "" {
		mn = 0
	} else {
		mn = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(modulename)))
	}
	ret, _, _ := getModuleHandle.Call(mn)
	return HINSTANCE(ret)
}

func MulDiv(number, numerator, denominator int) int {
	ret, _, _ := mulDiv.Call(
		uintptr(number),
		uintptr(numerator),
		uintptr(denominator),
	)
	return int(ret)
}

func GetConsoleWindow() HWND {
	ret, _, _ := getConsoleWindow.Call()
	return HWND(ret)
}

func GetCurrentThread() HANDLE {
	ret, _, _ := getCurrentThread.Call()
	return HANDLE(ret)
}

func GetLogicalDrives() uint32 {
	ret, _, _ := getLogicalDrives.Call()
	return uint32(ret)
}

func GetUserDefaultLCID() uint32 {
	ret, _, _ := getUserDefaultLCID.Call()
	return uint32(ret)
}

func Lstrlen(lpString *uint16) int {
	ret, _, _ := lstrlen.Call(uintptr(unsafe.Pointer(lpString)))
	return int(ret)
}

func Lstrcpy(buf []uint16, lpString *uint16) {
	lstrcpy.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(lpString)),
	)
}

func GlobalAlloc(uFlags uint, dwBytes uint32) HGLOBAL {
	ret, _, _ := globalAlloc.Call(
		uintptr(uFlags),
		uintptr(dwBytes))
	return HGLOBAL(ret)
}

func GlobalFree(hMem HGLOBAL) {
	globalFree.Call(uintptr(hMem))
}

func GlobalLock(hMem HGLOBAL) unsafe.Pointer {
	ret, _, _ := globalLock.Call(uintptr(hMem))
	return unsafe.Pointer(ret)
}

func GlobalUnlock(hMem HGLOBAL) bool {
	ret, _, _ := globalUnlock.Call(uintptr(hMem))
	return ret != 0
}

func MoveMemory(destination, source unsafe.Pointer, length uint32) {
	moveMemory.Call(
		uintptr(unsafe.Pointer(destination)),
		uintptr(source),
		uintptr(length),
	)
}

func FindResource(hModule HMODULE, lpName, lpType *uint16) (HRSRC, error) {
	ret, _, _ := findResource.Call(
		uintptr(hModule),
		uintptr(unsafe.Pointer(lpName)),
		uintptr(unsafe.Pointer(lpType)),
	)
	if ret == 0 {
		return 0, syscall.GetLastError()
	}
	return HRSRC(ret), nil
}

func SizeofResource(hModule HMODULE, hResInfo HRSRC) uint32 {
	ret, _, _ := sizeofResource.Call(
		uintptr(hModule),
		uintptr(hResInfo))
	return uint32(ret)
}

func LockResource(hResData HGLOBAL) unsafe.Pointer {
	ret, _, _ := lockResource.Call(uintptr(hResData))
	return unsafe.Pointer(ret)
}

func LoadResource(hModule HMODULE, hResInfo HRSRC) HGLOBAL {
	ret, _, _ := loadResource.Call(
		uintptr(hModule),
		uintptr(hResInfo),
	)
	return HGLOBAL(ret)
}

func GetLastError() uint32 {
	ret, _, _ := getLastError.Call()
	return uint32(ret)
}

func OpenProcess(desiredAccess uint32, inheritHandle bool, processId uint32) HANDLE {
	inherit := 0
	if inheritHandle {
		inherit = 1
	}
	ret, _, _ := openProcess.Call(
		uintptr(desiredAccess),
		uintptr(inherit),
		uintptr(processId),
	)
	return HANDLE(ret)
}

func TerminateProcess(hProcess HANDLE, uExitCode uint) bool {
	ret, _, _ := terminateProcess.Call(
		uintptr(hProcess),
		uintptr(uExitCode),
	)
	return ret != 0
}

func CloseHandle(object HANDLE) bool {
	ret, _, _ := closeHandle.Call(
		uintptr(object))
	return ret != 0
}

func CreateToolhelp32Snapshot(flags, processId uint32) HANDLE {
	ret, _, _ := createToolhelp32Snapshot.Call(
		uintptr(flags),
		uintptr(processId),
	)
	if ret <= 0 {
		return HANDLE(0)
	}
	return HANDLE(ret)
}

func Module32First(snapshot HANDLE, me *MODULEENTRY32) bool {
	ret, _, _ := module32First.Call(
		uintptr(snapshot),
		uintptr(unsafe.Pointer(me)),
	)
	return ret != 0
}

func Module32Next(snapshot HANDLE, me *MODULEENTRY32) bool {
	ret, _, _ := module32Next.Call(
		uintptr(snapshot),
		uintptr(unsafe.Pointer(me)),
	)
	return ret != 0
}

func GetSystemTimes(lpIdleTime, lpKernelTime, lpUserTime *FILETIME) bool {
	ret, _, _ := getSystemTimes.Call(
		uintptr(unsafe.Pointer(lpIdleTime)),
		uintptr(unsafe.Pointer(lpKernelTime)),
		uintptr(unsafe.Pointer(lpUserTime)),
	)
	return ret != 0
}

func GetProcessTimes(hProcess HANDLE, lpCreationTime, lpExitTime, lpKernelTime, lpUserTime *FILETIME) bool {
	ret, _, _ := getProcessTimes.Call(
		uintptr(hProcess),
		uintptr(unsafe.Pointer(lpCreationTime)),
		uintptr(unsafe.Pointer(lpExitTime)),
		uintptr(unsafe.Pointer(lpKernelTime)),
		uintptr(unsafe.Pointer(lpUserTime)),
	)
	return ret != 0
}

func GetConsoleScreenBufferInfo(hConsoleOutput HANDLE) *CONSOLE_SCREEN_BUFFER_INFO {
	var csbi CONSOLE_SCREEN_BUFFER_INFO
	ret, _, _ := getConsoleScreenBufferInfo.Call(
		uintptr(hConsoleOutput),
		uintptr(unsafe.Pointer(&csbi)),
	)
	if ret == 0 {
		return nil
	}
	return &csbi
}

func SetConsoleTextAttribute(hConsoleOutput HANDLE, wAttributes uint16) bool {
	ret, _, _ := setConsoleTextAttribute.Call(
		uintptr(hConsoleOutput),
		uintptr(wAttributes),
	)
	return ret != 0
}

func GetDiskFreeSpaceEx(dirName string) (r bool,
	freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes uint64) {
	ret, _, _ := getDiskFreeSpaceEx.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(dirName))),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalNumberOfBytes)),
		uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
	)
	return ret != 0,
		freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes
}

func GetSystemTime() (time SYSTEMTIME) {
	getSystemTime.Call(uintptr(unsafe.Pointer(&time)))
	return
}

func GetSystemTimeAsFileTime() (time FILETIME) {
	getSystemTimeAsFileTime.Call(uintptr(unsafe.Pointer(&time)))
	return
}

func SetSystemTime(time *SYSTEMTIME) bool {
	ret, _, _ := setSystemTime.Call(
		uintptr(unsafe.Pointer(time)))
	return ret != 0
}

func CopyMemory(dest, source unsafe.Pointer, sizeInBytes int) {
	copyMemory.Call(
		uintptr(dest),
		uintptr(source),
		uintptr(sizeInBytes),
	)
}

func GetCurrentProcessId() DWORD {
	id, _, _ := getCurrentProcessId.Call()
	return DWORD(id)
}

func GetVersion() uint32 {
	ret, _, _ := getVersion.Call()
	return uint32(ret)
}

func SetEnvironmentVariable(name, value string) bool {
	ret, _, _ := setEnvironmentVariable.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(name))),
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(value))),
	)
	return ret != 0
}

func GetComputerName() string {
	const maxLen = 128
	var buf [maxLen]uint16
	var size uint32 = maxLen
	ret, _, _ := getComputerName.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ret != 0 {
		return syscall.UTF16ToString(buf[:])
	}
	return ""
}

func CoInitializeEx(coInit uintptr) HRESULT {
	ret, _, _ := coInitializeEx.Call(
		0,
		coInit)

	switch uint32(ret) {
	case E_INVALIDARG:
		panic("CoInitializeEx failed with E_INVALIDARG")
	case E_OUTOFMEMORY:
		panic("CoInitializeEx failed with E_OUTOFMEMORY")
	case E_UNEXPECTED:
		panic("CoInitializeEx failed with E_UNEXPECTED")
	}

	return HRESULT(ret)
}

func CoInitialize() {
	coInitialize.Call(0)
}

func CoUninitialize() {
	coUninitialize.Call()
}

func CreateStreamOnHGlobal(hGlobal HGLOBAL, fDeleteOnRelease bool) *IStream {
	stream := new(IStream)
	ret, _, _ := createStreamOnHGlobal.Call(
		uintptr(hGlobal),
		uintptr(BoolToBOOL(fDeleteOnRelease)),
		uintptr(unsafe.Pointer(&stream)),
	)

	switch uint32(ret) {
	case E_INVALIDARG:
		panic("CreateStreamOnHGlobal failed with E_INVALIDARG")
	case E_OUTOFMEMORY:
		panic("CreateStreamOnHGlobal failed with E_OUTOFMEMORY")
	case E_UNEXPECTED:
		panic("CreateStreamOnHGlobal failed with E_UNEXPECTED")
	}

	return stream
}

func VariantInit(v *VARIANT) {
	hr, _, _ := variantInit.Call(uintptr(unsafe.Pointer(v)))
	if hr != 0 {
		panic("Invoke VariantInit error.")
	}
	return
}

func SysAllocString(v string) (ss *int16) {
	pss, _, _ := sysAllocString.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(v))),
	)
	ss = (*int16)(unsafe.Pointer(pss))
	return
}

func SysFreeString(v *int16) {
	hr, _, _ := sysFreeString.Call(uintptr(unsafe.Pointer(v)))
	if hr != 0 {
		panic("Invoke SysFreeString error.")
	}
	return
}

func SysStringLen(v *int16) uint {
	l, _, _ := sysStringLen.Call(uintptr(unsafe.Pointer(v)))
	return uint(l)
}

func WglCreateContext(hdc HDC) HGLRC {
	ret, _, _ := wglCreateContext.Call(
		uintptr(hdc),
	)
	return HGLRC(ret)
}

func WglCreateLayerContext(hdc HDC, iLayerPlane int) HGLRC {
	ret, _, _ := wglCreateLayerContext.Call(
		uintptr(hdc),
		uintptr(iLayerPlane),
	)
	return HGLRC(ret)
}

func WglDeleteContext(hglrc HGLRC) bool {
	ret, _, _ := wglDeleteContext.Call(
		uintptr(hglrc),
	)
	return ret == TRUE
}

func WglGetProcAddress(szProc string) uintptr {
	ret, _, _ := wglGetProcAddress.Call(
		uintptr(unsafe.Pointer(syscall.StringBytePtr(szProc))),
	)
	return ret
}

func WglMakeCurrent(hdc HDC, hglrc HGLRC) bool {
	ret, _, _ := wglMakeCurrent.Call(
		uintptr(hdc),
		uintptr(hglrc),
	)
	return ret == TRUE
}

func WglShareLists(hglrc1, hglrc2 HGLRC) bool {
	ret, _, _ := wglShareLists.Call(
		uintptr(hglrc1),
		uintptr(hglrc2),
	)
	return ret == TRUE
}

func EnumProcesses(processIds []uint32, cb uint32, bytesReturned *uint32) bool {
	ret, _, _ := enumProcesses.Call(
		uintptr(unsafe.Pointer(&processIds[0])),
		uintptr(cb),
		uintptr(unsafe.Pointer(bytesReturned)))
	return ret != 0
}

func SHBrowseForFolder(bi *BROWSEINFO) uintptr {
	ret, _, _ := sHBrowseForFolder.Call(uintptr(unsafe.Pointer(bi)))
	return ret
}

func SHGetPathFromIDList(idl uintptr) string {
	buf := make([]uint16, 1024)
	sHGetPathFromIDList.Call(
		idl,
		uintptr(unsafe.Pointer(&buf[0])),
	)
	return syscall.UTF16ToString(buf)
}

func DragAcceptFiles(hwnd HWND, accept bool) {
	dragAcceptFiles.Call(
		uintptr(hwnd),
		uintptr(BoolToBOOL(accept)),
	)
}

func DragQueryFile(hDrop HDROP, iFile uint) (fileName string, fileCount uint) {
	ret, _, _ := dragQueryFile.Call(
		uintptr(hDrop),
		uintptr(iFile),
		0,
		0,
	)

	fileCount = uint(ret)

	if iFile != 0xFFFFFFFF {
		buf := make([]uint16, fileCount+1)

		ret, _, _ := dragQueryFile.Call(
			uintptr(hDrop),
			uintptr(iFile),
			uintptr(unsafe.Pointer(&buf[0])),
			uintptr(fileCount+1))

		if ret == 0 {
			panic("Invoke DragQueryFile error.")
		}

		fileName = syscall.UTF16ToString(buf)
	}

	return
}

func DragQueryPoint(hDrop HDROP) (x, y int, isClientArea bool) {
	var pt POINT
	ret, _, _ := dragQueryPoint.Call(
		uintptr(hDrop),
		uintptr(unsafe.Pointer(&pt)),
	)
	return int(pt.X), int(pt.Y), (ret == 1)
}

func DragFinish(hDrop HDROP) {
	dragFinish.Call(uintptr(hDrop))
}

func ShellExecute(hwnd HWND, lpOperation, lpFile, lpParameters, lpDirectory string, nShowCmd int) error {
	var op, param, directory uintptr
	if len(lpOperation) != 0 {
		op = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpOperation)))
	}
	if len(lpParameters) != 0 {
		param = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpParameters)))
	}
	if len(lpDirectory) != 0 {
		directory = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpDirectory)))
	}

	ret, _, _ := shellExecute.Call(
		uintptr(hwnd),
		op,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpFile))),
		param,
		directory,
		uintptr(nShowCmd))

	errorMsg := ""
	if ret != 0 && ret <= 32 {
		switch int(ret) {
		case ERROR_FILE_NOT_FOUND:
			errorMsg = "The specified file was not found."
		case ERROR_PATH_NOT_FOUND:
			errorMsg = "The specified path was not found."
		case ERROR_BAD_FORMAT:
			errorMsg = "The .exe file is invalid (non-Win32 .exe or error in .exe image)."
		case SE_ERR_ACCESSDENIED:
			errorMsg = "The operating system denied access to the specified file."
		case SE_ERR_ASSOCINCOMPLETE:
			errorMsg = "The file name association is incomplete or invalid."
		case SE_ERR_DDEBUSY:
			errorMsg = "The DDE transaction could not be completed because other DDE transactions were being processed."
		case SE_ERR_DDEFAIL:
			errorMsg = "The DDE transaction failed."
		case SE_ERR_DDETIMEOUT:
			errorMsg = "The DDE transaction could not be completed because the request timed out."
		case SE_ERR_DLLNOTFOUND:
			errorMsg = "The specified DLL was not found."
		case SE_ERR_NOASSOC:
			errorMsg = "There is no application associated with the given file name extension. This error will also be returned if you attempt to print a file that is not printable."
		case SE_ERR_OOM:
			errorMsg = "There was not enough memory to complete the operation."
		case SE_ERR_SHARE:
			errorMsg = "A sharing violation occurred."
		default:
			errorMsg = fmt.Sprintf("Unknown error occurred with error code %v", ret)
		}
	} else {
		return nil
	}

	return errors.New(errorMsg)
}

func ExtractIcon(lpszExeFileName string, nIconIndex int) HICON {
	ret, _, _ := extractIcon.Call(
		0,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(lpszExeFileName))),
		uintptr(nIconIndex),
	)
	return HICON(ret)
}

func GetGpStatus(s int32) string {
	switch s {
	case Ok:
		return "Ok"
	case GenericError:
		return "GenericError"
	case InvalidParameter:
		return "InvalidParameter"
	case OutOfMemory:
		return "OutOfMemory"
	case ObjectBusy:
		return "ObjectBusy"
	case InsufficientBuffer:
		return "InsufficientBuffer"
	case NotImplemented:
		return "NotImplemented"
	case Win32Error:
		return "Win32Error"
	case WrongState:
		return "WrongState"
	case Aborted:
		return "Aborted"
	case FileNotFound:
		return "FileNotFound"
	case ValueOverflow:
		return "ValueOverflow"
	case AccessDenied:
		return "AccessDenied"
	case UnknownImageFormat:
		return "UnknownImageFormat"
	case FontFamilyNotFound:
		return "FontFamilyNotFound"
	case FontStyleNotFound:
		return "FontStyleNotFound"
	case NotTrueTypeFont:
		return "NotTrueTypeFont"
	case UnsupportedGdiplusVersion:
		return "UnsupportedGdiplusVersion"
	case GdiplusNotInitialized:
		return "GdiplusNotInitialized"
	case PropertyNotFound:
		return "PropertyNotFound"
	case PropertyNotSupported:
		return "PropertyNotSupported"
	case ProfileNotFound:
		return "ProfileNotFound"
	}
	return "Unknown Status Value"
}

func GdipCreateBitmapFromFile(filename string) (*uintptr, error) {
	var bitmap *uintptr
	ret, _, _ := gdipCreateBitmapFromFile.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(filename))),
		uintptr(unsafe.Pointer(&bitmap)),
	)

	if ret != Ok {
		return nil, errors.New(fmt.Sprintf(
			"GdipCreateBitmapFromFile failed with status '%s' for file '%s'",
			GetGpStatus(int32(ret)),
			filename,
		))
	}

	return bitmap, nil
}

func GdipCreateBitmapFromResource(instance HINSTANCE, resId *uint16) (*uintptr, error) {
	var bitmap *uintptr
	ret, _, _ := gdipCreateBitmapFromResource.Call(
		uintptr(instance),
		uintptr(unsafe.Pointer(resId)),
		uintptr(unsafe.Pointer(&bitmap)),
	)

	if ret != Ok {
		return nil, errors.New(fmt.Sprintf("GdiCreateBitmapFromResource failed with status '%s'", GetGpStatus(int32(ret))))
	}

	return bitmap, nil
}

func GdipCreateBitmapFromStream(stream *IStream) (*uintptr, error) {
	var bitmap *uintptr
	ret, _, _ := gdipCreateBitmapFromStream.Call(
		uintptr(unsafe.Pointer(stream)),
		uintptr(unsafe.Pointer(&bitmap)),
	)

	if ret != Ok {
		return nil, errors.New(fmt.Sprintf("GdipCreateBitmapFromStream failed with status '%s'", GetGpStatus(int32(ret))))
	}

	return bitmap, nil
}

func GdipCreateHBITMAPFromBitmap(bitmap *uintptr, background uint32) (HBITMAP, error) {
	var hbitmap HBITMAP
	ret, _, _ := gdipCreateHBITMAPFromBitmap.Call(
		uintptr(unsafe.Pointer(bitmap)),
		uintptr(unsafe.Pointer(&hbitmap)),
		uintptr(background),
	)

	if ret != Ok {
		return 0, errors.New(fmt.Sprintf("GdipCreateHBITMAPFromBitmap failed with status '%s'", GetGpStatus(int32(ret))))
	}

	return hbitmap, nil
}

func GdipDisposeImage(image *uintptr) {
	gdipDisposeImage.Call(uintptr(unsafe.Pointer(image)))
}

func GdiplusShutdown(token uintptr) {
	gdiplusShutdown.Call(token)
}

func GdiplusStartup(input *GdiplusStartupInput, output *GdiplusStartupOutput) uintptr {
	var token uintptr
	ret, _, _ := gdiplusStartup.Call(
		uintptr(unsafe.Pointer(&token)),
		uintptr(unsafe.Pointer(input)),
		uintptr(unsafe.Pointer(output)))

	if ret != Ok {
		panic("GdiplusStartup failed with status " + GetGpStatus(int32(ret)))
	}
	return token
}

func MakeIntResource(id uint16) *uint16 {
	return (*uint16)(unsafe.Pointer(uintptr(id)))
}

func LOWORD(dw uint32) uint16 {
	return uint16(dw)
}

func HIWORD(dw uint32) uint16 {
	return uint16(dw >> 16 & 0xffff)
}

func BoolToBOOL(value bool) BOOL {
	if value {
		return 1
	}
	return 0
}

func GetFileVersionInfoSize(path string) uint32 {
	ret, _, _ := getFileVersionInfoSize.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		0,
	)
	return uint32(ret)
}

func GetFileVersionInfo(path string, data []byte) bool {
	ret, _, _ := getFileVersionInfo.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		0,
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&data[0])),
	)
	return ret != 0
}

// VerQueryValueRoot calls VerQueryValue
// (https://msdn.microsoft.com/en-us/library/windows/desktop/ms647464(v=vs.85).aspx)
// with `\` (root) to retieve the VS_FIXEDFILEINFO.
func VerQueryValueRoot(block []byte) (VS_FIXEDFILEINFO, bool) {
	var offset uintptr
	var length uint
	blockStart := uintptr(unsafe.Pointer(&block[0]))
	ret, _, _ := verQueryValue.Call(
		blockStart,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(`\`))),
		uintptr(unsafe.Pointer(&offset)),
		uintptr(unsafe.Pointer(&length)),
	)
	if ret == 0 {
		return VS_FIXEDFILEINFO{}, false
	}
	start := int(offset) - int(blockStart)
	end := start + int(length)
	if start < 0 || start >= len(block) || end < start || end > len(block) {
		return VS_FIXEDFILEINFO{}, false
	}
	data := block[start:end]
	info := *((*VS_FIXEDFILEINFO)(unsafe.Pointer(&data[0])))
	return info, true
}

// VerQueryValueTranslations calls VerQueryValue
// (https://msdn.microsoft.com/en-us/library/windows/desktop/ms647464(v=vs.85).aspx)
// with `\VarFileInfo\Translation` to retrieve a list of 4-character translation
// strings as required by VerQueryValueString.
func VerQueryValueTranslations(block []byte) ([]string, bool) {
	var offset uintptr
	var length uint
	blockStart := uintptr(unsafe.Pointer(&block[0]))
	ret, _, _ := verQueryValue.Call(
		blockStart,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(`\VarFileInfo\Translation`))),
		uintptr(unsafe.Pointer(&offset)),
		uintptr(unsafe.Pointer(&length)),
	)
	if ret == 0 {
		return nil, false
	}
	start := int(offset) - int(blockStart)
	end := start + int(length)
	if start < 0 || start >= len(block) || end < start || end > len(block) {
		return nil, false
	}
	data := block[start:end]
	// each translation consists of a 16-bit language ID and a 16-bit code page
	// ID, so each entry has 4 bytes
	if len(data)%4 != 0 {
		return nil, false
	}
	trans := make([]string, len(data)/4)
	for i := range trans {
		t := data[i*4 : (i+1)*4]
		// handle endianness of the 16-bit values
		t[0], t[1] = t[1], t[0]
		t[2], t[3] = t[3], t[2]
		trans[i] = fmt.Sprintf("%x", t)
	}
	return trans, true
}

// these constants can be passed to VerQueryValueString as the item
const (
	CompanyName      = "CompanyName"
	FileDescription  = "FileDescription"
	FileVersion      = "FileVersion"
	LegalCopyright   = "LegalCopyright"
	LegalTrademarks  = "LegalTrademarks"
	OriginalFilename = "OriginalFilename"
	ProductVersion   = "ProductVersion"
	PrivateBuild     = "PrivateBuild"
	SpecialBuild     = "SpecialBuild"
)

// VerQueryValueString calls VerQueryValue
// (https://msdn.microsoft.com/en-us/library/windows/desktop/ms647464(v=vs.85).aspx)
// with `\StringFileInfo\...` to retrieve a specific piece of information as
// string in a specific translation.
func VerQueryValueString(block []byte, translation, item string) (string, bool) {
	var offset uintptr
	var utf16Length uint
	blockStart := uintptr(unsafe.Pointer(&block[0]))
	id := `\StringFileInfo\` + translation + `\` + item
	ret, _, _ := verQueryValue.Call(
		blockStart,
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(id))),
		uintptr(unsafe.Pointer(&offset)),
		uintptr(unsafe.Pointer(&utf16Length)),
	)
	if ret == 0 {
		return "", false
	}
	start := int(offset) - int(blockStart)
	end := start + int(2*utf16Length)
	if start < 0 || start >= len(block) || end < start || end > len(block) {
		return "", false
	}
	data := block[start:end]
	u16 := make([]uint16, utf16Length)
	for i := range u16 {
		u16[i] = uint16(data[i*2+1])<<8 | uint16(data[i*2+0])
	}
	return syscall.UTF16ToString(u16), true
}

func PlaySound(sound string, mod HMODULE, flags uint32) bool {
	ret, _, _ := playSound.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(sound))),
		uintptr(mod),
		uintptr(flags),
	)
	return ret != 0
}
