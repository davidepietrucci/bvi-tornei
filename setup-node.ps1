$url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
$zip = "c:\Users\davide.pietrucci\Desktop\DAVIDE\node.zip"
$dest = "c:\Users\davide.pietrucci\Desktop\DAVIDE"
$nodeDir = "c:\Users\davide.pietrucci\Desktop\DAVIDE\node"

Write-Host "Scaricando Node.js v22.14.0..."
Invoke-WebRequest -Uri $url -OutFile $zip

Write-Host "Estraendo l'archivio..."
Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item $zip

Write-Host "Rinominando la cartella..."
if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
Rename-Item "$dest\node-v22.14.0-win-x64" -NewName "node"

Write-Host "Aggiungendo Node.js al PATH dell'utente (non richiede privilegi di amministratore)..."
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notmatch [regex]::Escape($nodeDir)) {
    $newPath = if ($userPath) { "$userPath;$nodeDir" } else { $nodeDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "PATH aggiornato con successo."
} else {
    Write-Host "Node.js è già presente nel PATH dell'utente."
}

Write-Host "Installazione completata! Ora puoi avviare npm install e npm run dev in una nuova finestra del terminale."
