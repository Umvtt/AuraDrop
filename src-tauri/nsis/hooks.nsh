; AuraDrop NSIS hooks (wired up via bundle.windows.nsis.installerHooks).
;
; The glass setup app runs this installer silently and passes:
;   /NS         no desktop shortcut (built in; we also remove an old one)
;   /NOASSOC    don't open .auradrop files with AuraDrop
;   /AUTOSTART  start AuraDrop hidden in the tray when you sign in
;
; In a silent install an option that isn't passed is removed, so running
; setup again with a box unticked undoes it. The classic (non-silent)
; installer associates files and leaves the startup entry alone.

!define AURADROP_PROGID "AuraDrop.Design"
!define AURADROP_RUNKEY "Software\Microsoft\Windows\CurrentVersion\Run"

!macro AURADROP_UNASSOCIATE
  ReadRegStr $R9 HKCU "Software\Classes\.auradrop" ""
  ${If} $R9 == "${AURADROP_PROGID}"
    DeleteRegKey HKCU "Software\Classes\.auradrop"
  ${EndIf}
  DeleteRegKey HKCU "Software\Classes\${AURADROP_PROGID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; File association
  ${GetOptions} $CMDLINE "/NOASSOC" $R8
  ${If} ${Errors}
    WriteRegStr HKCU "Software\Classes\.auradrop" "" "${AURADROP_PROGID}"
    WriteRegStr HKCU "Software\Classes\.auradrop" "Content Type" "application/json"
    WriteRegStr HKCU "Software\Classes\${AURADROP_PROGID}" "" "AuraDrop Design"
    WriteRegStr HKCU "Software\Classes\${AURADROP_PROGID}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
    WriteRegStr HKCU "Software\Classes\${AURADROP_PROGID}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  ${Else}
    !insertmacro AURADROP_UNASSOCIATE
  ${EndIf}

  ; Start with Windows
  ${GetOptions} $CMDLINE "/AUTOSTART" $R8
  ${IfNot} ${Errors}
    WriteRegStr HKCU "${AURADROP_RUNKEY}" "${PRODUCTNAME}" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" --autostart"
  ${ElseIf} ${Silent}
    DeleteRegValue HKCU "${AURADROP_RUNKEY}" "${PRODUCTNAME}"
  ${EndIf}

  ; Desktop shortcut: /NS only stops the template from creating one, so
  ; also remove the one an earlier install made. Only touch it if it's ours.
  ${If} ${Silent}
    ${GetOptions} $CMDLINE "/NS" $R8
    ${IfNot} ${Errors}
      !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      Pop $R8
      ${If} $R8 = 1
        Delete "$DESKTOP\${PRODUCTNAME}.lnk"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; Tell Explorer that file associations changed (SHCNE_ASSOCCHANGED).
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; The template already removes the Run entry; associations are ours.
  ${If} $UpdateMode <> 1
    !insertmacro AURADROP_UNASSOCIATE
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
