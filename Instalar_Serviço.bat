::=====================================================
:: VERIFICAR package.json
::=====================================================

if not exist "%BASE_DIR%package.json" (
    echo.
    echo ERRO: package.json nao encontrado.
    pause
    exit /b 1
)

::=====================================================
:: INSTALAR DEPENDENCIAS
::=====================================================

echo.
echo ============================================
echo Instalando dependencias do projeto...
echo ============================================

pushd "%BASE_DIR%"

call npm install

if %errorlevel% neq 0 (
    echo.
    echo Falha ao executar npm install.
    popd
    pause
    exit /b 1
)

popd

echo Dependencias instaladas com sucesso.