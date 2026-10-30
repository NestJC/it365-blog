# IT365.kr 가비아 DNS -> GitHub Pages 연결 상태 자동 점검 스크립트
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " 🔍 IT365.kr 도메인 DNS 연결 상태 점검 (GitHub Pages)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$expectedIPs = @(
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153"
)

try {
    $aRecords = Resolve-DnsName -Name "it365.kr" -Type A -ErrorAction Stop | Select-Object -ExpandProperty IPAddress
    Write-Host "`n[1] 현재 it365.kr의 A 레코드 IP 목록:" -ForegroundColor Yellow
    foreach ($ip in $aRecords) {
        if ($expectedIPs -contains $ip) {
            Write-Host "  ✅ $ip (GitHub Pages 공식 IP 일치)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $ip (GitHub Pages IP가 아님 - 가비아에서 수정 필요)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "`n[1] 아직 it365.kr에 등록된 A 레코드가 조회되지 않습니다. 가비아 DNS 설정을 확인해 주세요." -ForegroundColor Yellow
}

try {
    $cnameRecords = Resolve-DnsName -Name "www.it365.kr" -Type CNAME -ErrorAction Stop
    Write-Host "`n[2] 현재 www.it365.kr의 CNAME 레코드:" -ForegroundColor Yellow
    foreach ($rec in $cnameRecords) {
        if ($rec.NameHost) {
            Write-Host "  ➡️ $($rec.NameHost)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "`n[2] 아직 www.it365.kr CNAME 레코드가 조회되지 않습니다." -ForegroundColor Yellow
}

try {
    $mxRecords = Resolve-DnsName -Name "it365.kr" -Type MX -ErrorAction Stop
    Write-Host "`n[3] 현재 it365.kr의 메일(MX) 레코드:" -ForegroundColor Yellow
    foreach ($mx in $mxRecords) {
        if ($mx.NameExchange) {
            Write-Host "  ✉️ $($mx.NameExchange) (우선순위: $($mx.Preference))" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "`n[3] 아직 it365.kr에 등록된 메일(MX) 레코드가 없습니다." -ForegroundColor Yellow
}

Write-Host "`n====================================================" -ForegroundColor Cyan
