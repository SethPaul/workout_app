#!/bin/bash

# Realtime Collaborative Platform CloudFormation Deployment Script
# This script deploys the entire infrastructure stack with proper dependency ordering

set -e

# Configuration
ENVIRONMENT_NAME=${1:-"prod"}
REGION=${2:-"us-east-1"}
DOMAIN_NAME=${3:-"collaborate.example.com"}
CERTIFICATE_ARN=${4}
CONTAINER_IMAGE=${5:-"your-account.dkr.ecr.${REGION}.amazonaws.com/collaboration-server:latest"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" &>/dev/null
}

# Function to wait for stack operation to complete
wait_for_stack() {
    local stack_name="$1"
    local operation="$2"
    
    log "Waiting for stack $stack_name to $operation..."
    
    aws cloudformation wait "stack-${operation}-complete" \
        --stack-name "$stack_name" \
        --region "$REGION" || {
        error "Stack $stack_name failed to $operation"
        return 1
    }
    
    success "Stack $stack_name $operation completed successfully"
}

# Function to deploy or update a stack
deploy_stack() {
    local stack_name="$1"
    local template_file="$2"
    local parameters="$3"
    
    log "Deploying stack: $stack_name"
    
    local operation
    if stack_exists "$stack_name"; then
        operation="update"
        log "Stack exists, updating..."
    else
        operation="create"
        log "Stack doesn't exist, creating..."
    fi
    
    # Deploy the stack
    aws cloudformation "${operation}-stack" \
        --stack-name "$stack_name" \
        --template-body "file://$template_file" \
        --parameters "$parameters" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" \
        --tags Key=Environment,Value="$ENVIRONMENT_NAME" Key=Project,Value="RealtimeCollaboration" || {
        error "Failed to $operation stack $stack_name"
        return 1
    }
    
    # Wait for completion
    wait_for_stack "$stack_name" "$operation"
}

# Function to validate parameters
validate_parameters() {
    if [[ -z "$CERTIFICATE_ARN" ]]; then
        error "Certificate ARN is required. Please provide it as the 4th parameter."
        error "Usage: $0 [environment] [region] [domain] [certificate-arn] [container-image]"
        exit 1
    fi
    
    if [[ ! "$CERTIFICATE_ARN" =~ ^arn:aws:acm: ]]; then
        error "Invalid certificate ARN format"
        exit 1
    fi
    
    log "Deploying to environment: $ENVIRONMENT_NAME"
    log "Region: $REGION"
    log "Domain: $DOMAIN_NAME"
    log "Certificate ARN: $CERTIFICATE_ARN"
    log "Container Image: $CONTAINER_IMAGE"
}

# Function to create parameter strings
create_parameters() {
    local param_string=""
    for param in "$@"; do
        param_string="${param_string}${param} "
    done
    echo "$param_string"
}

# Main deployment function
main() {
    log "Starting Realtime Collaborative Platform deployment..."
    
    # Validate inputs
    validate_parameters
    
    # Define stack names
    MAIN_STACK="${ENVIRONMENT_NAME}-collaboration-main"
    NETWORK_STACK="${ENVIRONMENT_NAME}-collaboration-network"
    DATABASE_STACK="${ENVIRONMENT_NAME}-collaboration-database"
    APPLICATION_STACK="${ENVIRONMENT_NAME}-collaboration-application"
    WEBSOCKET_STACK="${ENVIRONMENT_NAME}-collaboration-websocket"
    CDN_STACK="${ENVIRONMENT_NAME}-collaboration-cdn"
    MONITORING_STACK="${ENVIRONMENT_NAME}-collaboration-monitoring"
    
    # Create main stack parameters
    MAIN_PARAMS=$(create_parameters \
        "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT_NAME" \
        "ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME" \
        "ParameterKey=CertificateArn,ParameterValue=$CERTIFICATE_ARN" \
        "ParameterKey=ContainerImage,ParameterValue=$CONTAINER_IMAGE")
    
    # Deploy main stack (orchestrates everything)
    deploy_stack "$MAIN_STACK" "main.yaml" "$MAIN_PARAMS"
    
    success "All stacks deployed successfully!"
    
    # Output important endpoints
    log "Retrieving deployment information..."
    
    # Get outputs from CloudFormation
    APPLICATION_URL=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApplicationURL`].OutputValue' \
        --output text)
    
    WEBSOCKET_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiEndpoint`].OutputValue' \
        --output text)
    
    DASHBOARD_URL=$(aws cloudformation describe-stacks \
        --stack-name "$MAIN_STACK" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`MonitoringDashboard`].OutputValue' \
        --output text)
    
    echo ""
    success "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🌐 Application URL:${NC}      $APPLICATION_URL"
    echo -e "${GREEN}🔌 WebSocket Endpoint:${NC}   $WEBSOCKET_ENDPOINT"
    echo -e "${GREEN}📊 Monitoring Dashboard:${NC} $DASHBOARD_URL"
    echo -e "${GREEN}🏗️  Environment:${NC}          $ENVIRONMENT_NAME"
    echo -e "${GREEN}🌍 Region:${NC}               $REGION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Configure your DNS to point $DOMAIN_NAME to the CloudFront distribution"
    echo "2. Upload your frontend application to the S3 static assets bucket"
    echo "3. Build and push your container image to ECR: $CONTAINER_IMAGE"
    echo "4. Update the ECS service to deploy the new container"
    echo "5. Configure monitoring alerts by subscribing to the SNS topic"
    echo ""
    echo "📚 Documentation:"
    echo "- Architecture guide: REALTIME_COLLABORATIVE_PLATFORM_DESIGN.md"
    echo "- Implementation guide: IMPLEMENTATION_GUIDE.md"
    echo "- Component testing: ISOLATED_COMPONENTS_GUIDE.md"
    echo ""
}

# Script help
show_help() {
    echo "Realtime Collaborative Platform CloudFormation Deployment Script"
    echo ""
    echo "Usage: $0 [environment] [region] [domain] [certificate-arn] [container-image]"
    echo ""
    echo "Parameters:"
    echo "  environment     Environment name (dev|staging|prod) - default: prod"
    echo "  region          AWS region - default: us-east-1"
    echo "  domain          Domain name for the application - default: collaborate.example.com"
    echo "  certificate-arn SSL certificate ARN (required)"
    echo "  container-image Container image URI - default: your-account.dkr.ecr.region.amazonaws.com/collaboration-server:latest"
    echo ""
    echo "Examples:"
    echo "  $0 prod us-east-1 collaborate.example.com arn:aws:acm:us-east-1:123456789:certificate/abc-123"
    echo "  $0 dev us-west-2 dev.collaborate.example.com arn:aws:acm:us-east-1:123456789:certificate/def-456"
    echo ""
    echo "Prerequisites:"
    echo "- AWS CLI configured with appropriate permissions"
    echo "- SSL certificate created in ACM (must be in us-east-1 for CloudFront)"
    echo "- Docker image built and pushed to ECR"
    echo "- Route 53 hosted zone for the domain (optional, for automatic DNS)"
    echo ""
}

# Check for help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"