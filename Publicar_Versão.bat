@echo off
setlocal

title Publicar Nova Versao

echo.
set /p VERSAO=Versao (ex: api ou v3.0.0):
set /p MSG=Descricao da versao:

echo.
echo ============================
echo Publicando...
echo ============================

git fetch --tags

git add .

:: Só faz commit se houver alterações
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "%MSG%"
    if errorlevel 1 goto :erro
    git push origin main
    if errorlevel 1 goto :erro
) else (
    echo Nenhuma alteracao para commit.
)

echo.
echo ============================
echo Removendo tags antigas...
echo ============================

git tag -d %VERSAO% >nul 2>&1
git push origin --delete %VERSAO% >nul 2>&1

echo Criando nova tag...
git tag -a %VERSAO% -m "%MSG%"
if errorlevel 1 goto :erro

echo Enviando tag...
git push origin %VERSAO%
if errorlevel 1 goto :erro

echo.
echo Criando Release...

gh release delete %VERSAO% -y >nul 2>&1
gh release create %VERSAO% --title "%VERSAO%" --notes "%MSG%"
if errorlevel 1 (
    echo.
    echo ===================================
    echo GitHub CLI nao autenticado.
    echo Execute uma vez:
    echo.
    echo gh auth login
    echo.
    goto :fim
)

echo.
echo ============================
echo RELEASE PUBLICADA COM SUCESSO
echo ============================
goto :fim

:erro
echo.
echo **************************************
echo ERRO DURANTE A PUBLICACAO
echo **************************************

:fim
pause