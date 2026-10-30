@echo off
chcp 65001 > nul
echo ========================================================
echo 🚀 IT365.kr 로컬 블로그 개발 서버를 시작합니다...
echo ========================================================
cd /d "%~dp0"
if not exist "node_modules" (
    echo [1/2] 최초 1회 패키지(Astro) 설치 중... 잠시만 기다려 주세요.
    call npm install
)
echo [2/2] 로컬 미리보기 서버 구동 중 -> 브라우저에서 http://localhost:4321/ko/ 가 열립니다!
start http://localhost:4321/ko/
call npm run dev
pause
