# CloudFormation Infrastructure for Realtime Collaborative Platform

This directory contains the complete AWS CloudFormation infrastructure templates for deploying a production-ready realtime collaborative platform. The infrastructure is designed for high availability, scalability, and security.

## 🏗️ Architecture Overview

The infrastructure consists of multiple CloudFormation stacks that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CloudFront CDN                          │
│                     (Global Distribution)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 Application Load Balancer                      │
│                   (Multi-AZ, HTTPS)                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    ECS Fargate                                 │
│              (Auto Scaling, Multi-AZ)                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│     DynamoDB (State) + ElastiCache Redis (Scaling)            │
│                WebSocket API Gateway                           │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Template Structure

| Template | Purpose | Dependencies |
|----------|---------|--------------|
| `main.yaml` | **Orchestration** - Deploys all other stacks | None |
| `network.yaml` | **VPC, Subnets, Security Groups** | None |
| `database.yaml` | **DynamoDB + ElastiCache Redis** | Network |
| `application.yaml` | **ECS, ALB, Auto Scaling** | Network, Database |
| `websocket.yaml` | **API Gateway WebSocket + Lambda** | Database |
| `cdn.yaml` | **CloudFront + S3 + WAF** | Application, WebSocket |
| `monitoring.yaml` | **CloudWatch + Alarms + Dashboards** | Application |

## 🚀 Quick Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **SSL Certificate** in AWS Certificate Manager (must be in `us-east-1` for CloudFront)
3. **Domain name** with Route 53 hosted zone (optional)
4. **Container image** built and pushed to ECR

### Simple Deployment

```bash
# Make the deployment script executable
chmod +x deploy.sh

# Deploy with required parameters
./deploy.sh prod us-east-1 collaborate.example.com arn:aws:acm:us-east-1:123456789:certificate/abc-123
```

### Custom Deployment

```bash
# Deploy to development environment
./deploy.sh dev us-west-2 dev.collaborate.example.com \
  arn:aws:acm:us-east-1:123456789:certificate/def-456 \
  123456789.dkr.ecr.us-west-2.amazonaws.com/collaboration-server:v1.0.0
```

## 🔧 Manual Deployment

If you prefer to deploy individual stacks manually:

### 1. Network Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name prod-collaboration-network \
  --template-body file://network.yaml \
  --parameters ParameterKey=EnvironmentName,ParameterValue=prod \
  --region us-east-1
```

### 2. Database Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name prod-collaboration-database \
  --template-body file://database.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=prod \
    ParameterKey=VpcId,ParameterValue=vpc-123456 \
    ParameterKey=PrivateSubnetIds,ParameterValue="subnet-123,subnet-456" \
    ParameterKey=RedisInstanceType,ParameterValue=cache.r6g.large \
  --region us-east-1
```

### 3. Application Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name prod-collaboration-application \
  --template-body file://application.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=prod \
    ParameterKey=VpcId,ParameterValue=vpc-123456 \
    ParameterKey=PublicSubnetIds,ParameterValue="subnet-789,subnet-101" \
    ParameterKey=PrivateSubnetIds,ParameterValue="subnet-123,subnet-456" \
    ParameterKey=ContainerImage,ParameterValue=123456789.dkr.ecr.us-east-1.amazonaws.com/collaboration-server:latest \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:123456789:certificate/abc-123 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

## 🏷️ Parameters Reference

### Environment Configuration

| Parameter | Description | Default | Allowed Values |
|-----------|-------------|---------|----------------|
| `EnvironmentName` | Environment identifier | `prod` | `dev`, `staging`, `prod` |
| `VpcCidr` | VPC CIDR block | `10.0.0.0/16` | Valid CIDR |

### Domain & Security

| Parameter | Description | Required |
|-----------|-------------|----------|
| `DomainName` | Application domain name | ✅ |
| `CertificateArn` | SSL certificate ARN (us-east-1) | ✅ |

### Application Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ContainerImage` | Docker image URI | ECR placeholder |
| `DesiredCapacity` | Initial ECS task count | `2` |
| `MaxCapacity` | Maximum ECS task count | `10` |
| `MinCapacity` | Minimum ECS task count | `1` |

### Database Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `RedisInstanceType` | ElastiCache instance type | `cache.t3.micro` |

## 🔍 Environment-Specific Configuration

The templates automatically adjust resources based on the environment:

### Development (`dev`)
- **ECS**: 1-3 tasks, `cache.t3.micro`
- **Cost-optimized**: Smaller instances, single AZ for non-critical resources

### Staging (`staging`)
- **ECS**: 1-5 tasks, `cache.t3.small`
- **Production-like**: Multi-AZ with reduced capacity

### Production (`prod`)
- **ECS**: 2-20 tasks, `cache.r6g.large`
- **High availability**: Full redundancy, enhanced monitoring

## 🔐 Security Features

### Network Security
- **Private subnets** for application and database tiers
- **Security groups** with minimal required access
- **VPC endpoints** for cost-effective AWS service access
- **NAT Gateways** for secure outbound connectivity

### Data Protection
- **Encryption at rest** for DynamoDB and ElastiCache
- **Encryption in transit** with TLS 1.2+
- **KMS keys** for encryption key management
- **Secrets Manager** for sensitive configuration

### Access Control
- **IAM roles** with least privilege principles
- **Resource-based policies** for fine-grained access
- **VPC security groups** for network isolation

### Web Security
- **WAF** protection against common attacks
- **CloudFront** with security headers
- **Rate limiting** to prevent abuse

## 📊 Monitoring & Observability

### Built-in Monitoring
- **CloudWatch Dashboard** with key metrics
- **Automated alarms** for critical thresholds
- **SNS notifications** for alert management
- **Custom metrics** for business logic monitoring

### Key Metrics Tracked
- **ECS**: CPU, Memory, Task count
- **ALB**: Request count, Latency, Error rates
- **DynamoDB**: Read/Write capacity, Throttling
- **Redis**: CPU, Memory, Network I/O
- **WebSocket**: Connection count, Latency

### Log Management
- **Centralized logging** with CloudWatch Logs
- **Log retention** policies to manage costs
- **CloudWatch Insights** for log analysis

## 💰 Cost Optimization

### Design Decisions
- **Fargate Spot** instances for cost savings
- **Auto Scaling** to match demand
- **VPC Endpoints** to reduce NAT Gateway costs
- **S3 lifecycle policies** for log management

### Environment Sizing
| Resource | Dev | Staging | Production |
|----------|-----|---------|------------|
| ECS Tasks | 1-3 | 1-5 | 2-20 |
| Redis | t3.micro | t3.small | r6g.large |
| NAT Gateways | 1 | 2 | 2 |

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy Infrastructure
        run: |
          cd infrastructure/cloudformation
          ./deploy.sh prod us-east-1 collaborate.example.com \
            ${{ secrets.CERTIFICATE_ARN }} \
            ${{ secrets.CONTAINER_IMAGE }}
```

## 🛠️ Customization

### Adding New Environments

1. **Update mappings** in `main.yaml`:
```yaml
EnvironmentConfig:
  test:
    InstanceType: 'cache.t3.micro'
    MinCapacity: 1
    MaxCapacity: 2
    DesiredCapacity: 1
```

2. **Update parameters** in templates:
```yaml
AllowedValues: ['dev', 'staging', 'test', 'prod']
```

### Custom Domain Configuration

1. **Create Route 53 hosted zone**
2. **Update DNS records** to point to CloudFront
3. **Request SSL certificate** in ACM (us-east-1)

### Application Integration

#### Environment Variables
The ECS tasks receive these environment variables:
- `NODE_ENV=production`
- `REDIS_ENDPOINT=redis-cluster-endpoint`
- `DYNAMODB_TABLE=collaboration-state`
- `AWS_REGION=deployment-region`

#### Secrets
Sensitive data is stored in AWS Secrets Manager:
- Redis auth token
- Database credentials
- API keys

## 🚨 Troubleshooting

### Common Issues

#### Stack Creation Fails
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name prod-collaboration-main

# Check detailed error
aws cloudformation describe-stack-resources --stack-name prod-collaboration-main
```

#### ECS Tasks Not Starting
```bash
# Check ECS service events
aws ecs describe-services --cluster prod-collaboration-cluster --services prod-collaboration-service

# Check task definition
aws ecs describe-task-definition --task-definition prod-collaboration-task
```

#### WebSocket Connection Issues
```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/prod-websocket"

# Test WebSocket endpoint
wscat -c wss://api-id.execute-api.region.amazonaws.com/prod
```

### Rollback Procedures

#### Automatic Rollback
CloudFormation automatically rolls back failed deployments.

#### Manual Rollback
```bash
# Rollback to previous version
aws cloudformation cancel-update-stack --stack-name prod-collaboration-main

# Delete failed stack
aws cloudformation delete-stack --stack-name prod-collaboration-main
```

## 📞 Support

### Documentation Links
- [Architecture Design](../../REALTIME_COLLABORATIVE_PLATFORM_DESIGN.md)
- [Implementation Guide](../../IMPLEMENTATION_GUIDE.md)
- [Component Testing](../../ISOLATED_COMPONENTS_GUIDE.md)

### Stack Outputs
After deployment, key information is available in CloudFormation outputs:
- Application URL
- WebSocket endpoint  
- Monitoring dashboard URL
- Resource identifiers

### Monitoring Resources
- CloudWatch Dashboard: Available in AWS Console
- SNS Alerts: Configure email subscriptions
- Custom Metrics: Application-specific monitoring

## 🔄 Updates & Maintenance

### Regular Updates
1. **Security patches**: Update base images and dependencies
2. **Capacity planning**: Monitor usage and adjust limits
3. **Cost optimization**: Review resources and usage patterns

### Version Management
- Use semantic versioning for container images
- Tag CloudFormation stacks with version information
- Maintain deployment history for rollback capability

---

For additional support and detailed implementation guidance, refer to the comprehensive documentation in the project root directory.