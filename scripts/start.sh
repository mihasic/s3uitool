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
eval "$(aws configure export-credentials $PROFILE_ARG --format env)"

if [ $? -ne 0 ]; then
    echo "Error fetching credentials. Ensure you are logged in."
    exit 1
fi

# Check validity
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "Error: Failed to obtain AccessKeyId."
    exit 1
fi

export AWS_DEFAULT_REGION="$REGION"

export AWS_DEFAULT_REGION="$REGION"

echo "Starting s3uitool..."
docker compose -f "$DIR/docker-compose.yml" up
