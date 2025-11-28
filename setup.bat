@echo off
REM ========================================
REM YouTube Scraper Backend - Setup для Windows
REM ========================================

echo.
echo ╔════════════════════════════════════════╗
echo ║  🚀 YouTube Scraper Backend Setup 🚀   ║
echo ╚════════════════════════════════════════╝
echo.

REM Шаг 1: Проверить что Node.js установлен
echo [1/5] Проверяю Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не установлен!
    echo Установи с: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js установлен

REM Шаг 2: Проверить что npm установлен
echo [2/5] Проверяю npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm не установлен!
    pause
    exit /b 1
)
echo ✅ npm установлен

REM Шаг 3: Создать папку backend если её нет
echo [3/5] Создаю папку backend...
if not exist "backend" (
    mkdir backend
    echo ✅ Папка backend создана
) else (
    echo ✅ Папка backend уже существует
)

REM Шаг 4: Перейти в backend и установить зависимости
echo [4/5] Устанавливаю зависимости (это займёт 2-5 минут)...
cd backend

REM Проверить что package.json существует
if not exist "package.json" (
    echo ❌ Файл package.json не найден в backend/
    echo Убедись что скопировал package.json в backend/
    pause
    exit /b 1
)

REM Установить npm зависимости
call npm install
if errorlevel 1 (
    echo ❌ Ошибка при установке зависимостей
    pause
    exit /b 1
)
echo ✅ Зависимости установлены

REM Шаг 5: Проверить что .env существует
echo [5/5] Проверяю конфигурацию...
if not exist ".env" (
    echo ❌ Файл .env не найден!
    echo Создай файл .env с содержимым:
    echo.
    echo YOUTUBE_API_KEY=your_key_here
    echo PORT=5000
    echo NODE_ENV=development
    echo FRONTEND_URL=http://localhost:3000
    echo.
    pause
    exit /b 1
)
echo ✅ Файл .env найден

echo.
echo ╔════════════════════════════════════════╗
echo ║  ✅ ВСЕ ГОТОВО К ЗАПУСКУ!             ║
echo ╚════════════════════════════════════════╝
echo.
echo Следующий шаг:
echo 1. Открой файл .env и добавь YOUTUBE_API_KEY
echo 2. Запусти: npm start
echo.
pause
