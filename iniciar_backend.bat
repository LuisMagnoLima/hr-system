@echo off
setlocal

title HR System - Backend
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

if not exist "%BACKEND%\app.py" (
  echo ERRO: backend\app.py nao foi encontrado.
  echo Execute este arquivo dentro da pasta principal do HR System.
  pause
  exit /b 1
)

if not exist "%ROOT%.env" (
  echo ERRO: arquivo .env nao encontrado na pasta principal.
  echo Copie .env.example para .env e configure as credenciais.
  pause
  exit /b 1
)

cd /d "%BACKEND%"

if not exist "venv\Scripts\python.exe" (
  echo Criando ambiente virtual...
  py -m venv venv
  if errorlevel 1 goto :erro

  call "venv\Scripts\activate.bat"
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  if errorlevel 1 goto :erro
) else (
  call "venv\Scripts\activate.bat"
)

echo.
echo Iniciando BACKEND em http://127.0.0.1:5000
echo Teste de saude: http://127.0.0.1:5000/health
echo Nao feche esta janela enquanto estiver usando o sistema.
echo.

python app.py
if errorlevel 1 goto :erro
endlocal
exit /b 0

:erro
echo.
echo ERRO: o backend nao conseguiu iniciar.
pause
endlocal
exit /b 1
