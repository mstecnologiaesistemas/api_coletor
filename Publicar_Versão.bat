@echo off
title Publicar Nova Versao

echo.
set /p VERSAO=Versao (ex: v3.0.0):
set /p MSG=Descricao da versao:

echo.
echo ============================
echo Publicando...
echo ============================

git add .

git commit -m "%MSG%"

git push origin main

git tag -a %VERSAO% -m "%MSG%"

git push origin %VERSAO%

gh release create %VERSAO% --title "%VERSAO%" --notes "%MSG%"

echo.
echo ============================
echo RELEASE PUBLICADA COM SUCESSO
echo ============================
pause