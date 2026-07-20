@echo off
setlocal

title HR System - Frontend
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "PORT=5501"

if not exist "%FRONTEND%\login.html" (
  echo ERRO: frontend\login.html nao foi encontrado.
  echo Execute este arquivo dentro da pasta principal do HR System.
  pause
  exit /b 1
)

cd /d "%FRONTEND%"

echo Iniciando FRONTEND em http://127.0.0.1:%PORT%/login.html
echo Nao feche esta janela enquanto estiver usando o sistema.
echo.

start "" /b cmd /c "timeout /t 2 /nobreak >nul && start "" "http://127.0.0.1:%PORT%/login.html""
py -m http.server %PORT% --bind 127.0.0.1

if errorlevel 1 (
  echo.
  echo ERRO: nao foi possivel iniciar o frontend na porta %PORT%.
  echo Verifique se o Python esta instalado e se a porta esta livre.
  pause
)
endlocal
