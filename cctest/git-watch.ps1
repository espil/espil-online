# Git 실시간 업데이트 받기 (Windows PowerShell)

# 이 스크립트를 cctest 폴더에서 실행하면 원격 변경사항을 자동으로 받아옴

$branch = "local-testing"
$interval = 10  # 10초마다 확인

Write-Host "Git 실시간 업데이트 시작 (브랜치: $branch, ${interval}초 간격)" -ForegroundColor Green
Write-Host "중지하려면 Ctrl+C" -ForegroundColor Yellow

while ($true) {
    git fetch origin $branch --quiet
    $local = git rev-parse HEAD
    $remote = git rev-parse "origin/$branch"
    
    if ($local -ne $remote) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 업데이트 발견! Pull 중..." -ForegroundColor Cyan
        git pull origin $branch --quiet
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 완료!" -ForegroundColor Green
    }
    
    Start-Sleep -Seconds $interval
}
