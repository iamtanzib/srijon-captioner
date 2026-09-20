Option Explicit
On Error Resume Next

Dim shell
Set shell = CreateObject("WScript.Shell")

' The information-style popup uses the standard Windows alert sound and closes
' automatically, so a completed long transcription never leaves a blocking box.
shell.Popup "Your caption job finished successfully." & vbCrLf & _
            "Return to Premiere Pro - your aligned captions are ready.", _
            12, "Srijon Captioner", 64
