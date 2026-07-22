@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Atualizador API Coletor

::=====================================================
:: CONFIGURACOES
::=====================================================

set "SERVICO=coletor"

set "URL=https://github.com/mstecnologiaesistemas/api_coletor/archive/refs/heads/main.zip"

set "DESTINO=%~dp0"

set "TEMP=%TEMP%\ApiColetor_Update"

set "ZIP=%TEMP%\api.zip"

set "LOG=%DESTINO%Atualizacao.log"

::=====================================================
:: LOG
::=====================================================

echo.>>"%LOG%"
echo =====================================================>>"%LOG%"
echo %date% %time%>>"%LOG%"
echo Iniciando Atualizacao>>"%LOG%"

echo.
echo =====================================================
echo        ATUALIZADOR API COLETOR
echo =====================================================
echo.

::=====================================================
:: PARAR SERVICO
::=====================================================

echo Parando servico...

if exist "%DESTINO%nssm.exe" (

    "%DESTINO%nssm.exe" stop %SERVICO%

    timeout /t 5 >nul

)

::=====================================================
:: LIMPAR TEMP
::=====================================================

if exist "%TEMP%" rd /s /q "%TEMP%"

mkdir "%TEMP%"

::=====================================================
:: DOWNLOAD
::=====================================================

echo.
echo Baixando ultima versao...

powershell -ExecutionPolicy Bypass ^
-Command "Invoke-WebRequest '%URL%' -OutFile '%ZIP%'"

if not exist "%ZIP%" (

    echo.
    echo ERRO AO BAIXAR O ARQUIVO.

    echo Falha Download>>"%LOG%"

    goto ERRO

)

::=====================================================
:: EXTRAIR ZIP
::=====================================================

echo.
echo Extraindo arquivos...

powershell -ExecutionPolicy Bypass ^
-Command "Expand-Archive '%ZIP%' '%TEMP%' -Force"

for /d %%i in ("%TEMP%\*") do (
    set "ORIGEM=%%i"
    goto ORIGEMOK
)

:ORIGEMOK

if not exist "%ORIGEM%" (

    echo.
    echo Pasta extraida nao encontrada.

    goto ERRO

)

::=====================================================
:: REMOVER ATRIBUTO SOMENTE LEITURA
::=====================================================

attrib -R "%DESTINO%\*" /S >nul 2>&1

::=====================================================
:: COPIAR ARQUIVOS
::=====================================================

echo.
echo Atualizando arquivos...

robocopy "%ORIGEM%" "%DESTINO%" ^
/MIR ^
/R:2 ^
/W:2 ^
/FFT ^
/Z ^
/COPY:DAT ^
/DCOPY:DAT ^
/XD ".git" "logs" "data" ^
/XF ".env" "config.json" "Atualizacao.log"

set RC=%ERRORLEVEL%

if %RC% GEQ 8 (

    echo.
    echo Erro durante a copia.

    echo Robocopy Error %RC%>>"%LOG%"

    goto ERRO

)

echo Arquivos atualizados.>>"%LOG%"

::=====================================================
:: INSTALAR DEPENDENCIAS
::=====================================================

if exist "%DESTINO%package.json" (

    echo.
    echo Atualizando dependencias...

    cd /d "%DESTINO%"

    if exist "package-lock.json" (

        call npm ci --omit=dev

    ) else (

        call npm install --omit=dev

    )

)

::=====================================================
:: REINICIAR SERVICO
::=====================================================

echo.
echo Reiniciando servico...

if exist "%DESTINO%nssm.exe" (

    "%DESTINO%nssm.exe" start %SERVICO%

)

::=====================================================
:: FINALIZACAO
::=====================================================

echo.
echo =====================================================
echo        ATUALIZACAO CONCLUIDA COM SUCESSO
echo =====================================================

echo Atualizacao concluida com sucesso>>"%LOG%"

rd /s /q "%TEMP%" >nul 2>&1

pause
exit /b 0

::=====================================================
:: ERRO
::=====================================================

:ERRO

echo.
echo #####################################################
echo              ERRO NA ATUALIZACAO
echo #####################################################

echo.

echo Consulte:

echo %LOG%

echo Falha na Atualizacao>>"%LOG%"

if exist "%TEMP%" rd /s /q "%TEMP%" >nul 2>&1

pause

exit /b 1