@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="" (
  node scripts/github-ai-sync.cjs status
  echo.
  echo [사용법]
  echo   github-sync.bat save "커밋 메시지"  : AI 번들 갱신 + GitHub 원클릭 저장(Push)
  echo   github-sync.bat pull               : GitHub 최신 소스 가져오기(Pull)
  echo   github-sync.bat status             : 로컬-GitHub 저장 상태 확인
  echo   github-sync.bat repos              : 내 GitHub 저장소 전체 목록 조회
  echo   github-sync.bat bundle             : AI용 컨텍스트 번들(llms.txt, llms-full.txt) 생성
  goto :eof
)

node scripts/github-ai-sync.cjs %*
