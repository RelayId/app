[CmdletBinding()]
param(
    [string]$BuildRoot = 'C:\relayid-android-build',
    [string]$Serial,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$env:NO_COLOR = $null
$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-InputHash([string[]]$Paths) {
    $entries = foreach ($path in $Paths) {
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $file = Get-Item -LiteralPath $path
            "{0}|{1}|{2}" -f $file.FullName, $file.LastWriteTimeUtc.Ticks, $file.Length
        }
    }

    $bytes = [Text.Encoding]::UTF8.GetBytes(($entries -join "`n"))
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha256.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $BuildRoot)) {
    New-Item -ItemType Directory -Path $BuildRoot | Out-Null
}

Get-ChildItem -LiteralPath $SourceRoot -Force |
    Where-Object { $_.Name -notin @('node_modules', '.expo', 'android', 'ios') } |
    Copy-Item -Destination $BuildRoot -Recurse -Force

$lockHashPath = Join-Path $BuildRoot '.pnpm-lock.sha256'
$lockHash = Get-InputHash @((Join-Path $SourceRoot 'pnpm-lock.yaml'))
$needsInstall = -not (Test-Path -LiteralPath (Join-Path $BuildRoot 'node_modules'))
if (-not $needsInstall -and ((Get-Content -LiteralPath $lockHashPath -ErrorAction SilentlyContinue) -ne $lockHash)) {
    $needsInstall = $true
}

Push-Location $BuildRoot
try {
    if ($needsInstall) {
        Invoke-Checked 'pnpm' @('install', '--frozen-lockfile', '--node-linker=hoisted')
        Set-Content -LiteralPath $lockHashPath -Value $lockHash -NoNewline
    }

    $nativeHashPath = Join-Path $BuildRoot '.native-inputs.sha256'
    $nativeInputs = @(
        'app.json',
        'package.json',
        'pnpm-lock.yaml',
        'babel.config.js',
        'metro.config.js',
        'modules/relayid-wear/package.json',
        'modules/relayid-wear/expo-module.config.json',
        'modules/relayid-wear/android/build.gradle',
        'modules/relayid-wear/android/src/main/AndroidManifest.xml'
    ) | ForEach-Object { Join-Path $SourceRoot $_ }
    $nativeHash = Get-InputHash $nativeInputs
    $needsPrebuild = -not (Test-Path -LiteralPath (Join-Path $BuildRoot 'android'))
    if (-not $needsPrebuild -and ((Get-Content -LiteralPath $nativeHashPath -ErrorAction SilentlyContinue) -ne $nativeHash)) {
        $needsPrebuild = $true
    }

    if ($needsPrebuild) {
        $env:NODE_ENV = 'production'
        Invoke-Checked 'pnpm' @('exec', 'expo', 'prebuild', '--platform', 'android')
        Set-Content -LiteralPath $nativeHashPath -Value $nativeHash -NoNewline
    }

    $env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Android\Sdk' }
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
    Push-Location (Join-Path $BuildRoot 'android')
    try {
        Invoke-Checked '.\gradlew.bat' @('assembleRelease', '--console', 'plain', '--warning-mode', 'none', '-PreactNativeArchitectures=arm64-v8a')
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}

$apk = Join-Path $BuildRoot 'android\app\build\outputs\apk\release\app-release.apk'
Write-Output "APK=$apk"

if ($Install) {
    if (-not $Serial) {
        $Serial = adb devices | Select-String '\sdevice$' | ForEach-Object { ($_ -split '\s+')[0] } |
            Where-Object { $_ -notlike 'emulator-*' } | Select-Object -First 1
    }
    if (-not $Serial) {
        throw 'No physical Android device was found. Pass -Serial explicitly or connect a device.'
    }

    Invoke-Checked 'adb' @('-s', $Serial, 'install', '--user', '0', '-r', $apk)
    Invoke-Checked 'adb' @('-s', $Serial, 'shell', 'am', 'start', '-W', '-n', 'com.relayid.app/.MainActivity')
}
