import { NextResponse } from 'next/server';


const INSTALL_SCRIPT = `# SkillBank CLI Installer for Windows
# Usage: irm https://skillbank.dev/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Configuration
$InstallDir = "$env:USERPROFILE\\.local\\bin"
$BinaryName = "skillbank.exe"
$GitHubRepo = "yan-labs/skillbank"
$Version = if ($args[0]) { $args[0] } else { "latest" }

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-Platform {
    $arch = [System.Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")
    switch ($arch) {
        "AMD64" { return "windows-x64" }
        "ARM64" { return "windows-arm64" }
        default {
            Write-ColorOutput "Error: Unsupported architecture: $arch" "Red"
            exit 1
        }
    }
}

function Get-LatestVersion {
    if ($Version -eq "latest") {
        try {
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/releases/latest" -UseBasicParsing
            $script:Version = $release.tag_name
        } catch {
            Write-ColorOutput "Warning: Could not fetch latest version" "Yellow"
        }
    }
    Write-ColorOutput "Installing version: $Version" "Blue"
}

function Install-Binary {
    param([string]$Platform)

    $BinaryUrl = "https://github.com/$GitHubRepo/releases/download/$Version/skillbank-$Platform.tar.gz"

    Write-ColorOutput "Downloading SkillBank CLI..." "Blue"
    Write-Host "  URL: $BinaryUrl"

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $TempDir = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "skillbank-install-$(Get-Random)") -Force
    $TarPath = Join-Path $TempDir "skillbank.tar.gz"
    $OutputPath = Join-Path $InstallDir $BinaryName

    try {
        # Download
        Invoke-WebRequest -Uri $BinaryUrl -OutFile $TarPath -UseBasicParsing

        # Extract (Windows 10+ has tar)
        tar -xzf $TarPath -C $TempDir

        # Find and move binary
        $ExtractedBinary = Get-ChildItem -Path $TempDir -Filter "skillbank-*" -File | Select-Object -First 1
        if (-not $ExtractedBinary) {
            Write-ColorOutput "Error: Binary not found in archive" "Red"
            exit 1
        }

        Copy-Item $ExtractedBinary.FullName $OutputPath -Force
        Write-ColorOutput "Binary installed to: $OutputPath" "Green"
    }
    finally {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")

    if ($currentPath -notlike "*$InstallDir*") {
        Write-ColorOutput "Adding $InstallDir to PATH..." "Yellow"
        $newPath = "$InstallDir;$currentPath"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        $env:PATH = "$InstallDir;$env:PATH"
        Write-ColorOutput "Added to PATH" "Green"
    }
}

function Test-Installation {
    $BinaryPath = Join-Path $InstallDir $BinaryName

    if (Test-Path $BinaryPath) {
        Write-Host ""
        Write-ColorOutput "========================================" "Green"
        Write-ColorOutput " SkillBank CLI installed successfully! " "Green"
        Write-ColorOutput "========================================" "Green"
        Write-Host ""
        Write-Host "To get started:"
        Write-Host ""
        Write-ColorOutput "  skillbank --help" "Blue"
        Write-Host ""
        Write-Host "Quick start:"
        Write-Host ""
        Write-ColorOutput "  skillbank search git" "Blue"
        Write-ColorOutput "  skillbank add git-commit" "Blue"
        Write-ColorOutput "  skillbank login" "Blue"
        Write-Host ""
        Write-Host "Note: You may need to restart your terminal for PATH changes."
        Write-Host ""
    }
    else {
        Write-ColorOutput "Installation failed." "Red"
        exit 1
    }
}

# Main
function Main {
    Write-Host ""
    Write-ColorOutput "=========================================" "Blue"
    Write-ColorOutput "     SkillBank CLI Installer             " "Blue"
    Write-ColorOutput "     https://skillbank.dev               " "Blue"
    Write-ColorOutput "=========================================" "Blue"
    Write-Host ""

    $Platform = Get-Platform
    Write-ColorOutput "Detected platform: $Platform" "Blue"

    Get-LatestVersion
    Install-Binary -Platform $Platform
    Add-ToPath
    Test-Installation
}

Main
`;

export async function GET() {
  return new NextResponse(INSTALL_SCRIPT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="install.ps1"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
