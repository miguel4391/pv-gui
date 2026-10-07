Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & "C:\pv-gui\ArrancarApp.bat" & Chr(34), 0
Set WshShell = Nothing