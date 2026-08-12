$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check for aws command
if (-not (Get-Command "aws" -ErrorAction SilentlyContinue)) {
    Write-Error "Error: 'aws' command not found. Please install AWS CLI."
    exit 1
}

# Determine Profile
$ProfileArg = @()
if (-not [string]::IsNullOrEmpty($env:AWS_PROFILE)) {
    $ProfileArg = @("--profile", $env:AWS_PROFILE)
    Write-Host "Using AWS_PROFILE=$env:AWS_PROFILE"
} else {
    Write-Host "Using default AWS profile"
}

# Determine Region
$Region = $env:AWS_REGION
if ([string]::IsNullOrEmpty($Region)) {
    try {
        $Region = aws configure get region @ProfileArg 2>$null
    } catch {
        # ignore
    }
}
if ([string]::IsNullOrEmpty($Region)) {
    $Region = "us-east-1" # Fallback
}

Write-Host "Fetching credentials..."
try {
    $CredsJson = aws configure export-credentials @ProfileArg
    $Creds = $CredsJson | ConvertFrom-Json
} catch {
    Write-Error "Failed to fetch credentials. Ensure you are logged in (aws sso login)."
    exit 1
}

# Set environment variables for the process (passed to docker-compose)
$env:AWS_ACCESS_KEY_ID = $Creds.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $Creds.SecretAccessKey
if (-not [string]::IsNullOrEmpty($Creds.SessionToken)) {
    $env:AWS_SESSION_TOKEN = $Creds.SessionToken
}
$env:AWS_DEFAULT_REGION = $Region

Write-Host "Starting s3uitool..."
docker compose -f "$ScriptDir\docker-compose.yml" up
