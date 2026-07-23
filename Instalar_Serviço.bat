@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Instalador do Servico Coletor

:: =====================================================
:: CONFIGURACOES
:: =====================================================

set "SERVICE_NAME=coletor"

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

set "NSSM=%BASE_DIR%\nssm.exe"
set "NODE_INSTALLER=%BASE_DIR%\node.msi"
set "LOG_DIR=%BASE_DIR%\logs"

echo.
echo ============================================================
echo              INSTALADOR DO SERVICO COLETOR
echo ============================================================
echo.
echo Diretorio da API:
echo %BASE_DIR%
echo.

:: =====================================================
:: EXECUTAR COMO ADMINISTRADOR
:: =====================================================

net session >nul 2>&1

if not "%errorlevel%"=="0" (
    echo.
    echo ERRO:
    echo Execute este arquivo como Administrador.
    echo.
    pause
    exit /b 1
)

:: =====================================================
:: VERIFICAR NSSM
:: =====================================================

echo Verificando NSSM...

if not exist "%NSSM%" (
    echo.
    echo ERRO:
    echo Arquivo nao encontrado:
    echo %NSSM%
    echo.
    pause
    exit /b 1
)

echo OK

:: =====================================================
:: VERIFICAR NODE
:: =====================================================

echo.
echo Verificando Node.js...

where node >nul 2>&1

if errorlevel 1 (

    echo Node.js nao encontrado.

    if exist "%NODE_INSTALLER%" (

        echo.
        echo Instalando Node.js...
        msiexec /i "%NODE_INSTALLER%" /qn /norestart

        timeout /t 20 >nul

        set "PATH=C:\Program Files\nodejs;%PATH%"

    ) else (

        echo.
        echo ERRO:
        echo node.msi nao encontrado.
        echo.
        pause
        exit /b 1

    )

)

:: =====================================================
:: LOCALIZAR NODE.EXE
:: =====================================================

set "NODE_EXE="

for /f "delims=" %%i in ('where node 2^>nul') do (
    set "NODE_EXE=%%i"
    goto NodeFound
)

:NodeFound

if not defined NODE_EXE (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    )
)

if not exist "%NODE_EXE%" (
    echo.
    echo ERRO:
    echo node.exe nao encontrado.
    pause
    exit /b 1
)

echo.
echo Node localizado:
echo %NODE_EXE%
echo.

"%NODE_EXE%" -v

:: =====================================================
:: VALIDAR PROJETO
:: =====================================================

if not exist "%BASE_DIR%\package.json" (
    echo.
    echo ERRO:
    echo package.json nao encontrado.
    pause
    exit /b 1
)

if not exist "%BASE_DIR%\src\server.js" (
    echo.
    echo ERRO:
    echo src\server.js nao encontrado.
    pause
    exit /b 1
)

:: =====================================================
:: CRIAR ARQUIVO .ENV
:: =====================================================

if not exist "%BASE_DIR%\.env" (

    echo.
    echo Criando arquivo .env...

    (
    echo PORT=3000
    echo NODE_ENV=PRODUCAO
    echo.
    echo # Obrigatorio: defina uma chave forte e unica. O valor de exemplo abaixo e invalido.
    echo JWT_SECRET=MINHA_KEY_PARA_ACESSO_A_API
    echo JWT_EXPIRES_IN=24h
    echo JWT_REFRESH_EXPIRES_IN=7d
    echo.
    echo # Obrigatorio para habilitar a limpeza global protegida via /api/inventory/all
    echo GLOBAL_PURGE_SECRET=SENHALIMPARBASES
    echo.
    echo CORS_ORIGIN=*
    echo.
    echo # Recomenda-se usar caminho relativo a partir da pasta /api
    echo DB_PATH=./data/database.sqlite
    echo.
    echo # Em desenvolvimento o rate limit ja fica desligado por padrao.
    echo # Use true ou false para sobrescrever esse comportamento.
    echo RATE_LIMIT_ENABLED=true
    ) > "%BASE_DIR%\.env"

    echo Arquivo .env criado.

) else (
    echo Arquivo .env ja existe. Mantendo configuracao atual.
)

:: =====================================================
:: INSTALAR DEPENDENCIAS
:: =====================================================

echo.
echo Instalando dependencias...

pushd "%BASE_DIR%"

call "%NODE_EXE:node.exe=npm.cmd%" install

if errorlevel 1 (
    echo.
    echo ERRO ao executar npm install.
    popd
    pause
    exit /b 1
)

popd

echo Dependencias instaladas.

:: =====================================================
:: LOGS
:: =====================================================

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
)

:: =====================================================
:: REMOVER SERVICO EXISTENTE
:: =====================================================

sc query "%SERVICE_NAME%" >nul 2>&1

if not errorlevel 1 (

    echo.
    echo Removendo servico existente...

    net stop "%SERVICE_NAME%" >nul 2>&1

    "%NSSM%" remove "%SERVICE_NAME%" confirm

    timeout /t 3 >nul

)

:: =====================================================
:: CRIAR SERVICO
:: =====================================================

echo.
echo Criando servico...

"%NSSM%" install "%SERVICE_NAME%" "%NODE_EXE%" "src\server.js"

if errorlevel 1 (
    echo.
    echo ERRO ao criar servico.
    pause
    exit /b 1
)

:: =====================================================
:: CONFIGURACOES NSSM
:: =====================================================

echo Configurando servico...

"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%BASE_DIR%"
"%NSSM%" set "%SERVICE_NAME%" DisplayName "Coletor"
"%NSSM%" set "%SERVICE_NAME%" Description "API Coletor Patrimonial"
"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START

:: =====================================================
:: LOGS
:: =====================================================

"%NSSM%" set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\stdout.log"
"%NSSM%" set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\stderr.log"
"%NSSM%" set "%SERVICE_NAME%" AppRotateFiles 1
"%NSSM%" set "%SERVICE_NAME%" AppRotateOnline 1
"%NSSM%" set "%SERVICE_NAME%" AppRotateBytes 10485760

:: =====================================================
:: RECUPERACAO
:: =====================================================

"%NSSM%" set "%SERVICE_NAME%" AppExit Default Restart

sc failure "%SERVICE_NAME%" reset=0 actions=restart/5000/restart/5000/restart/5000 >nul

:: =====================================================
:: INICIAR SERVICO
:: =====================================================

echo.
echo Iniciando servico...

net start "%SERVICE_NAME%"

if errorlevel 1 (

    echo.
    echo ============================================================
    echo O SERVICO FOI CRIADO MAS NAO INICIOU
    echo ============================================================
    echo.
    echo Consulte os arquivos:
    echo.
    echo %LOG_DIR%\stdout.log
    echo %LOG_DIR%\stderr.log
    echo.
    pause
    exit /b 1

)

:: =====================================================
:: FINAL
:: =====================================================

echo.
echo ============================================================
echo          SERVICO INSTALADO COM SUCESSO
echo ============================================================
echo.
echo Servico..............: %SERVICE_NAME%
echo Node.................: %NODE_EXE%
echo Startup Directory....: %BASE_DIR%
echo Arguments............: src\server.js
echo Logs.................: %LOG_DIR%
echo.

pause
exit /b 0