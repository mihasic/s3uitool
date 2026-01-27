#!/bin/bash
set -e

# Determine script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

# Check for aws command
if ! command -v aws &> /dev/null; then
    echo "Error: 'aws' command not found. Please install AWS CLI."
    exit 1
fi

# Determine Profile
PROFILE_ARG=""
if [ ! -z "$AWS_PROFILE" ]; then
    PROFILE_ARG="--profile $AWS_PROFILE"
    echo "Using AWS_PROFILE=$AWS_PROFILE"
else
    echo "Using default AWS profile"
fi

# Determine Region
if [ ! -z "$AWS_REGION" ]; then
    REGION=$AWS_REGION
else
    REGION=$(aws configure get region $PROFILE_ARG)
fi
if [ -z "$REGION" ]; then
    REGION="us-east-1" # Fallback
fi

echo "Fetching credentials..."
CRED_VALUES=$(aws configure export-credentials $PROFILE_ARG --output text --query "[AccessKeyId, SecretAccessKey, SessionToken]")

if [ $? -ne 0 ]; then
    echo "Error fetching credentials. Ensure you are logged in."
    exit 1
fi

# Read space-separated values
read -r ACCESS_KEY SECRET_KEY SESSION_TOKEN <<< "$CRED_VALUES"

# Check validity
if [ -z "$ACCESS_KEY" ] || [ "$ACCESS_KEY" == "None" ]; then
    echo "Error: Failed to obtain AccessKeyId."
    exit 1
fi

# Export variables for docker-compose
export AWS_ACCESS_KEY_ID="$ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$SECRET_KEY"

if [ ! -z "$SESSION_TOKEN" ] && [ "$SESSION_TOKEN" != "None" ]; then
    export AWS_SESSION_TOKEN="$SESSION_TOKEN"
fi

export AWS_DEFAULT_REGION="$REGION"

echo "Starting s3uitool..."
docker compose -f "$DIR/docker-compose.yml" up
