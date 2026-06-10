bun run build
$manifest = "dist\direct_ofertas\assets\_tanstack-start-manifest_v-BOvSFToU.js"
if (Test-Path $manifest) {
    $clientEntry = (Get-ChildItem dist\client\assets\index-*.js | Where-Object { $_.Length -gt 600000 } | Select-Object -First 1).Name
    (Get-Content $manifest) -replace '/@id/virtual:tanstack-start-client-entry', "/assets/$clientEntry" | Set-Content $manifest
    Write-Host "Fixed manifest: $clientEntry"
}
