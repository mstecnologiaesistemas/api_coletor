@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Instalador - Servico Coletor

::====================================================
:: CONFIGURACOES
::====================================================

set "SERVICE_NAME=coletor"
set "BASE_DIR=%~dp0"
set "NSSM=%BASE_DIR%nssm.exe"
set "NODE_INSTALLER=%BASE_DIR%node.msi"
set "LOG_DIR=%BASE_DIR%logs"

echo.
echo ==========================================================
echo           INSTALADOR DO SERVICO COLETOR
echo ==========================================================
echo.

::====================================================
:: VERIFICAR PRIVILEGIOS
::====================================================

net session >nul 2>&1

if not "%errorlevel%"=="0" (
    echo.
    echo ERRO:
    echo Execute este arquivo como ADMINISTRADOR.
    echo.
    pause
    exit /b 1
)

::====================================================
:: VERIFICAR NSSM
::====================================================

if not exist "%NSSM%" (

    echo.
    echo ERRO:
    echo nssm.exe nao encontrado.
    echo.
    pause
    exit /b 1

)

::====================================================
:: VERIFICAR NODE
::====================================================

where node >nul 2>&1

if errorlevel 1 (

    echo.
    echo Node.js nao encontrado.

    if exist "%NODE_INSTALLER%" (

        echo.
        echo Instalando Node.js...
        echo Aguarde...

        msiexec /i "%NODE_INSTALLER%" /qn /norestart

        timeout /t 10 >nul

        set PATH=%PATH%;C:\Program Files\nodejs

    ) else (

        echo.
        echo ERRO:
        echo Node.js nao instalado.
        echo.
        echo Coloque o arquivo:
        echo node.msi
        echo na mesma pasta deste instalador.
        echo.
        pause
        exit /b 1

    )

)

::====================================================
:: LOCALIZAR NODE
::====================================================

set NODE_EXE=

for /f "delims=" %%i in ('where node') do (
    set NODE_EXE=%%i
    goto NodeFound
)

:NodeFound

if "%NODE_EXE%"=="" (

    if exist "C:\Program Files\nodejs\node.exe" (
        set NODE_EXE=C:\Program Files\nodejs\node.exe
    )

)

if not exist "%NODE_EXE%" (

    echo.
    echo Nao foi possivel localizar o node.exe
    pause
    exit /b 1

)

echo Node localizado:
echo %NODE_EXE%

::====================================================
:: LOCALIZAR NPM
::====================================================

set NPM_CMD=

for /f "delims=" %%i in ('where npm.cmd') do (
    set NPM_CMD=%%i
    goto NpmFound
)

:NpmFound

if "%NPM_CMD%"=="" (

    if exist "C:\Program Files\nodejs\npm.cmd" (
        set NPM_CMD=C:\Program Files\nodejs\npm.cmd
    )

)

if not exist "%NPM_CMD%" (

    echo.
    echo npm.cmd nao encontrado.
    pause
    exit /b 1

)

echo npm localizado:
echo %NPM_CMD%

::====================================================
:: VERIFICAR package.json
::====================================================

if not exist "%BASE_DIR%package.json" (

    echo.
    echo package.json nao encontrado.
    pause
    exit /b 1

)

::====================================================
:: INSTALAR DEPENDENCIAS
::====================================================

echo.
echo ==========================================================
echo INSTALANDO DEPENDENCIAS
echo ==========================================================

pushd "%BASE_DIR%"

call "%NPM_CMD%" install

if errorlevel 1 (

    echo.
    echo Falha durante npm install
    popd
    pause
    exit /b 1

)

echo.
echo Dependencias instaladas.

echo.
echo Executando npm audit fix...

call "%NPM_CMD%" audit fix

popd

::====================================================
:: CRIAR PASTA LOGS
::====================================================

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
)

::====================================================
:: REMOVER SERVICO ANTIGO
::====================================================

sc query "%SERVICE_NAME%" >nul 2>&1

if not errorlevel 1 (

    echo.
    echo Removendo servico antigo...

    net stop "%SERVICE_NAME%" >nul 2>&1

    "%NSSM%" remove "%SERVICE_NAME%" confirm

    timeout /t 3 >nul

)

::====================================================
:: CRIAR SERVICO
::====================================================

echo.
echo Criando servico...

"%NSSM%" install "%SERVICE_NAME%" "%NPM_CMD%" start

"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%BASE_DIR%"

"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START

::====================================================
:: RECUPERACAO
::====================================================

"%NSSM%" set "%SERVICE_NAME%" AppExit Default Restart

sc failure "%SERVICE_NAME%" reset= 0 actions= restart/5000/restart/5000/restart/5000

::====================================================
:: LOGS
::====================================================

"%NSSM%" set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\stdout.log"

"%NSSM%" set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\stderr.log"

"%NSSM%" set "%SERVICE_NAME%" AppRotateFiles 1

"%NSSM%" set "%SERVICE_NAME%" AppRotateOnline 1

"%NSSM%" set "%SERVICE_NAME%" AppRotateBytes 10485760

::====================================================
:: INICIAR SERVICO
::====================================================

echo.
echo Iniciando servico...

net start "%SERVICE_NAME%"

if errorlevel 1 (

    echo.
    echo O servico foi criado, mas nao iniciou.
    echo Consulte:
    echo %LOG_DIR%\stderr.log
    echo.
    pause
    exit /b 1

)

echo.
echo ==========================================================
echo INSTALACAO CONCLUIDA COM SUCESSO
echo ==========================================================
echo.
echo Servico........: %SERVICE_NAME%
echo Diretorio......: %BASE_DIR%
echo Node...........: %NODE_EXE%
echo NPM............: %NPM_CMD%
echo Logs...........: %LOG_DIR%
echo.
echo O servico sera iniciado automaticamente junto com o Windows.
echo.

pause