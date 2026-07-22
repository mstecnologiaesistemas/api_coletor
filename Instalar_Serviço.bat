@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Instalador do Servico Coletor

::=========================================================
:: CONFIGURACOES
::=========================================================

set "SERVICE_NAME=coletor"
set "BASE_DIR=%~dp0"
set "NSSM=%BASE_DIR%nssm.exe"
set "NODE_INSTALLER=%BASE_DIR%node.msi"
set "LOG_DIR=%BASE_DIR%logs"

echo.
echo ======================================================
echo        INSTALADOR DO SERVICO COLETOR
echo ======================================================
echo.

::=========================================================
:: VERIFICAR ADMINISTRADOR
::=========================================================

net session >nul 2>&1

if not %errorlevel%==0 (
    echo.
    echo Execute este arquivo como Administrador.
    pause
    exit /b 1
)

::=========================================================
:: VERIFICAR NSSM
::=========================================================

if not exist "%NSSM%" (
    echo.
    echo ERRO: nssm.exe nao encontrado.
    pause
    exit /b 1
)

::=========================================================
:: VERIFICAR NODE
::=========================================================

where node >nul 2>&1

if errorlevel 1 (

    echo.
    echo Node.js nao encontrado.

    if exist "%NODE_INSTALLER%" (

        echo Instalando Node.js...
        msiexec /i "%NODE_INSTALLER%" /qn /norestart

        timeout /t 10 >nul

        set PATH=%PATH%;C:\Program Files\nodejs

    ) else (

        echo.
        echo ERRO:
        echo Node.js nao instalado.
        echo Coloque o arquivo node.msi na mesma pasta.
        pause
        exit /b 1

    )

)

::=========================================================
:: LOCALIZAR NODE.EXE
::=========================================================

set "NODE_EXE="

for /f "delims=" %%i in ('where node') do (
    set "NODE_EXE=%%i"
    goto NODEFOUND
)

:NODEFOUND

if "%NODE_EXE%"=="" (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    )
)

if not exist "%NODE_EXE%" (
    echo.
    echo ERRO: node.exe nao encontrado.
    pause
    exit /b 1
)

echo.
echo Node localizado em:
echo %NODE_EXE%

::=========================================================
:: VERIFICAR package.json
::=========================================================

if not exist "%BASE_DIR%package.json" (
    echo.
    echo package.json nao encontrado.
    pause
    exit /b 1
)

::=========================================================
:: INSTALAR DEPENDENCIAS
::=========================================================

echo.
echo Instalando dependencias...

pushd "%BASE_DIR%"

call npm install

if errorlevel 1 (
    echo.
    echo Erro ao executar npm install.
    popd
    pause
    exit /b 1
)

popd

echo Dependencias instaladas.

::=========================================================
:: CRIAR LOGS
::=========================================================

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

::=========================================================
:: REMOVER SERVICO ANTIGO
::=========================================================

sc query "%SERVICE_NAME%" >nul 2>&1

if not errorlevel 1 (

    echo.
    echo Removendo servico existente...

    net stop "%SERVICE_NAME%" >nul 2>&1

    "%NSSM%" remove "%SERVICE_NAME%" confirm

    timeout /t 3 >nul

)

::=========================================================
:: CRIAR SERVICO
::=========================================================

echo.
echo Criando servico...

"%NSSM%" install "%SERVICE_NAME%" "%NODE_EXE%" "src\server.js"

::=========================================================
:: CONFIGURACOES DO NSSM
::=========================================================

"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%BASE_DIR%"

"%NSSM%" set "%SERVICE_NAME%" DisplayName "Coletor"

"%NSSM%" set "%SERVICE_NAME%" Description "API Coletor"

"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START"

::=========================================================
:: LOGS
::=========================================================

"%NSSM%" set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\stdout.log"

"%NSSM%" set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\stderr.log"

"%NSSM%" set "%SERVICE_NAME%" AppRotateFiles 1

"%NSSM%" set "%SERVICE_NAME%" AppRotateOnline 1

"%NSSM%" set "%SERVICE_NAME%" AppRotateBytes 10485760

::=========================================================
:: RECUPERACAO
::=========================================================

"%NSSM%" set "%SERVICE_NAME%" AppExit Default Restart

sc failure "%SERVICE_NAME%" reset=0 actions=restart/5000/restart/5000/restart/5000

::=========================================================
:: INICIAR SERVICO
::=========================================================

echo.
echo Iniciando servico...

net start "%SERVICE_NAME%"

if errorlevel 1 (

    echo.
    echo O servico foi criado, mas nao iniciou.
    echo.
    echo Consulte:
    echo %LOG_DIR%\stderr.log
    echo.
    pause
    exit /b 1

)

echo.
echo ======================================================
echo SERVICO INSTALADO COM SUCESSO
echo ======================================================
echo.
echo Nome.................: %SERVICE_NAME%
echo Node.................: %NODE_EXE%
echo Diretorio da API.....: %BASE_DIR%
echo Executavel...........: src\server.js
echo.

pause