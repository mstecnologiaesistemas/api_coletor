@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Atualizador API Coletor

::==========================
:: CONFIGURAÇÕES
::==========================

set SERVICO=coletor

set URL=https://github.com/mstecnologiaesistemas/api_coletor/archive/refs/heads/main.zip

set DESTINO=%~dp0

set TEMP=%TEMP%\ApiColetor_Update
set ZIP=%TEMP%\api.zip

set LOG=%DESTINO%Atualizacao.log

echo.>>"%LOG%"
echo ==========================================>>"%LOG%"
echo %date% %time%>>"%LOG%"
echo Iniciando Atualizacao>>"%LOG%"

echo.
echo ==========================================
echo ATUALIZADOR API COLETOR
echo ==========================================
echo.

::==========================
:: PARAR SERVIÇO
::==========================

echo Parando servico...

if exist "%DESTINO%nssm.exe" (

    "%DESTINO%nssm.exe" stop %SERVICO%

    timeout /t 5 >nul

)

::==========================
:: LIMPAR TEMP
::==========================

if exist "%TEMP%" rd /s /q "%TEMP%"
if exist "%ZIP%" del /q "%ZIP%"

mkdir "%TEMP%"

::==========================
:: DOWNLOAD
::==========================

echo.
echo Baixando nova versao...

powershell -ExecutionPolicy Bypass -Command ^
"Invoke-WebRequest '%URL%' -OutFile '%ZIP%'"

if not exist "%ZIP%" (

    echo ERRO AO BAIXAR.
    echo Erro Download>>"%LOG%"
    goto ERRO

)

::==========================
:: EXTRAIR
::==========================

echo.
echo Extraindo...

powershell -ExecutionPolicy Bypass -Command ^
"Expand-Archive '%ZIP%' '%TEMP%' -Force"

for /d %%i in ("%TEMP%\*") do set ORIGEM=%%i

::==========================
:: COPIAR ARQUIVOS
::==========================

echo.
echo Atualizando arquivos...

robocopy "%ORIGEM%" "%DESTINO%" /E /R:2 /W:2 ^
/XD data logs .git ^
/XF .env config.json Atualizacao.log >nul

::==========================
:: INSTALAR DEPENDÊNCIAS
::==========================

if exist "%DESTINO%package.json" (

    echo.
    echo Instalando dependencias...

    cd /d "%DESTINO%"

    call npm install --production

)

::==========================
:: REINICIAR SERVIÇO
::==========================

echo.
echo Reiniciando servico...

if exist "%DESTINO%nssm.exe" (

    "%DESTINO%nssm.exe" start %SERVICO%

)

echo.
echo Atualizacao concluida.

echo Atualizacao OK>>"%LOG%"

pause
exit

:ERRO

echo.
echo #########################################
echo ERRO NA ATUALIZACAO
echo #########################################

echo Consulte o log:
echo %LOG%

pause