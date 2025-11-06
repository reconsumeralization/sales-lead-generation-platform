# PowerShell script to test if all services can start properly

Write-Host "Testing Sales Lead Generation Platform Services..." -ForegroundColor Green

$services = @(
    "api-gateway",
    "lead-scoring", 
    "outreach-generation",
    "deal-intelligence",
    "crm-sync",
    "compliance",
    "analytics"
)

foreach ($service in $services) {
    Write-Host "Testing $service service..." -ForegroundColor Yellow
    
    Set-Location "services/$service"
    
    # Try to compile TypeScript
    $compileResult = npx tsc --noEmit 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ${service}: TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "❌ ${service}: TypeScript compilation failed" -ForegroundColor Red
        Write-Host $compileResult -ForegroundColor Red
    }
    
    Set-Location "../.."
}

Write-Host "Service testing completed!" -ForegroundColor Green