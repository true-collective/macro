/**
 * Slice 3 — G1 app landing (staging smoke first).
 *
 * Pre-AKV safe path: one Fargate service on existing ALB HTTP listener using
 * ECR image `tc-macro/authentication-service:<tag>` (default tag `smoke` =
 * nginx alpine placeholder until real nix/Docker builds land).
 *
 * Needs: Slice 0 cluster + Slice 1 ALB/listener/ECS SG + Slice 2 ECR repos.
 * Blocked for real Macro: AKV secrets, FusionAuth SMTP, MSK/OS (paid GO).
 */
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();
const environment = cfg.get("environment") ?? "dev";
const namePrefix = `tc-macro-${environment}`;
const foundationStack =
  cfg.get("foundationStack") ?? "organization/tc-macro-foundation/dev";
const dataPlaneStack =
  cfg.get("dataPlaneStack") ?? "organization/tc-macro-data-plane/dev";
const authImageTag = cfg.get("authImageTag") ?? "smoke";
const enableAuth = cfg.getBoolean("enableAuthService") ?? true;

const foundation = new pulumi.StackReference(foundationStack);
const dataPlane = new pulumi.StackReference(dataPlaneStack);

const privateSubnetIds = foundation.requireOutput(
  "privateSubnetIds",
) as pulumi.Output<string[]>;
const ecsClusterArn = foundation.requireOutput(
  "ecsClusterArn",
) as pulumi.Output<string>;
const httpListenerArn = dataPlane.requireOutput(
  "httpListenerArn",
) as pulumi.Output<string>;
const ecsSecurityGroupId = dataPlane.requireOutput(
  "ecsSecurityGroupId",
) as pulumi.Output<string>;
const albSecurityGroupId = dataPlane.requireOutput(
  "albSecurityGroupId",
) as pulumi.Output<string>;

// Slice 1 ECS SG only opened 8080; smoke nginx listens on 80
new aws.ec2.SecurityGroupRule(`${namePrefix}-g1-ecs-http80`, {
  type: "ingress",
  securityGroupId: ecsSecurityGroupId,
  fromPort: 80,
  toPort: 80,
  protocol: "tcp",
  sourceSecurityGroupId: albSecurityGroupId,
  description: "ALB to G1 smoke/tasks on :80",
});

const accountId = aws.getCallerIdentityOutput().accountId;
const region = aws.config.region ?? "us-east-1";
const authRepo = pulumi.interpolate`${accountId}.dkr.ecr.${region}.amazonaws.com/tc-macro/authentication-service`;
const authImage = pulumi.interpolate`${authRepo}:${authImageTag}`;

const commonTags = {
  Project: "tc-macro",
  Slice: "3",
  Environment: environment,
};

const logGroup = new aws.cloudwatch.LogGroup(`${namePrefix}-g1-logs`, {
  name: `/ecs/${namePrefix}-g1`,
  retentionInDays: 7,
  tags: commonTags,
});

const execRole = new aws.iam.Role(`${namePrefix}-g1-exec`, {
  name: `${namePrefix}-g1-exec`,
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  tags: commonTags,
});

new aws.iam.RolePolicyAttachment(`${namePrefix}-g1-exec-ecr`, {
  role: execRole.name,
  policyArn:
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

const taskRole = new aws.iam.Role(`${namePrefix}-g1-task`, {
  name: `${namePrefix}-g1-task`,
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  tags: commonTags,
});

let authServiceName: pulumi.Output<string> | undefined;
let authTargetGroupArn: pulumi.Output<string> | undefined;

if (enableAuth) {
  const tg = new aws.lb.TargetGroup(`${namePrefix}-auth-tg`, {
    name: `${namePrefix}-auth`.slice(0, 32),
    port: 80,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: foundation.requireOutput("vpcId") as pulumi.Output<string>,
    healthCheck: {
      enabled: true,
      path: "/",
      matcher: "200-399",
      interval: 30,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    },
    tags: { ...commonTags, Service: "authentication-service" },
  });

  new aws.lb.ListenerRule(`${namePrefix}-auth-rule`, {
    listenerArn: httpListenerArn,
    priority: 10,
    actions: [{ type: "forward", targetGroupArn: tg.arn }],
    conditions: [{ pathPattern: { values: ["/", "/*"] } }],
    tags: commonTags,
  });

  const taskDef = new aws.ecs.TaskDefinition(`${namePrefix}-auth-td`, {
    family: `${namePrefix}-authentication-service`,
    cpu: "256",
    memory: "512",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: execRole.arn,
    taskRoleArn: taskRole.arn,
    containerDefinitions: pulumi
      .all([authImage, logGroup.name, region])
      .apply(([image, lg, reg]) =>
        JSON.stringify([
          {
            name: "authentication-service",
            image,
            essential: true,
            portMappings: [{ containerPort: 80, protocol: "tcp" }],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": lg,
                "awslogs-region": reg,
                "awslogs-stream-prefix": "auth",
              },
            },
          },
        ]),
      ),
    tags: commonTags,
  });

  const svc = new aws.ecs.Service(
    `${namePrefix}-auth-svc`,
    {
      name: `${namePrefix}-authentication-service`,
      cluster: ecsClusterArn,
      taskDefinition: taskDef.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: privateSubnetIds,
        securityGroups: [ecsSecurityGroupId],
        assignPublicIp: false,
      },
      loadBalancers: [
        {
          targetGroupArn: tg.arn,
          containerName: "authentication-service",
          containerPort: 80,
        },
      ],
      healthCheckGracePeriodSeconds: 60,
      tags: { ...commonTags, Service: "authentication-service" },
    },
    { dependsOn: [tg] },
  );

  authServiceName = svc.name;
  authTargetGroupArn = tg.arn;
}

export const slice = "3";
export const authImageUri = authImage;
export const authEcsServiceName = authServiceName ?? pulumi.output("");
export const authTargetGroup = authTargetGroupArn ?? pulumi.output("");
export const note =
  "Smoke uses nginx:alpine tagged as authentication-service:smoke until real Macro binaries. FA/MSK/OS/AKV not in this stack.";
