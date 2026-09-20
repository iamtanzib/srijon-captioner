Option Explicit
Dim shell, fso, scriptDir, pythonExe, serverPy, modelDir, cmd, customPython, customModels
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Portable defaults created by setup/SETUP_ALL_NEW_DEVICE.bat
pythonExe = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SrijonCaptioner\runtime\whisperx-venv\Scripts\python.exe")
modelDir = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\SrijonCaptioner\models")

' Optional per-user overrides for advanced/dev setups.
customPython = shell.Environment("USER")("SRIJON_CAPTIONER_PYTHON")
customModels = shell.Environment("USER")("SRIJON_CAPTIONER_MODEL_DIR")
If Len(customPython) > 0 Then pythonExe = customPython
If Len(customModels) > 0 Then modelDir = customModels

serverPy = fso.BuildPath(scriptDir, "server.py")
If Not fso.FileExists(pythonExe) Then WScript.Quit 2
If Not fso.FileExists(serverPy) Then WScript.Quit 3

shell.Environment("PROCESS")("WHISPERX_MODEL_DIR") = modelDir
cmd = Chr(34) & pythonExe & Chr(34) & " " & Chr(34) & serverPy & Chr(34)
' 0 = hidden window, False = do not wait for server to exit
shell.Run cmd, 0, False
