/**
 * Slice 1 — ALB (HTTP staging), RDS Postgres MacroDB, ElastiCache Redis.
 * Depends on Slice 0 stack outputs (tc-macro-foundation/dev).
 * No app images / FusionAuth / MSK / OpenSearch here.
 */
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

const cfg = new pulumi.Config();
const environment = cfg.get("environment") ?? "dev";
const namePrefix = `tc-macro-${environment}`;
const foundationStack =
  cfg.get("foundationStack") ?? "tc-macro-foundation/dev";
const dbInstanceClass = cfg.get("dbInstanceClass") ?? "db.t4g.micro";
const redisNodeType = cfg.get("redisNodeType") ?? "cache.t4g.micro";

const foundation = new pulumi.StackReference(foundationStack);
const vpcId = foundation.requireOutput("vpcId") as pulumi.Output<string>;
const publicSubnetIds = foundation.requireOutput(
  "publicSubnetIds",
) as pulumi.Output<string[]>;
const privateSubnetIds = foundation.requireOutput(
  "privateSubnetIds",
) as pulumi.Output<string[]>;

// --- Security groups ---
const albSg = new aws.ec2.SecurityGroup(`${namePrefix}-alb-sg`, {
  vpcId,
  description: "TC Macro ALB — HTTP (HTTPS/ACM later)",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
      description: "HTTP staging",
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: `${namePrefix}-alb-sg`, Project: "tc-macro", Slice: "1" },
});

const ecsSg = new aws.ec2.SecurityGroup(`${namePrefix}-ecs-sg`, {
  vpcId,
  description: "TC Macro ECS tasks (Fargate) — Slice 1 landing",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 8080,
      toPort: 8080,
      securityGroups: [albSg.id],
      description: "ALB to tasks",
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: `${namePrefix}-ecs-sg`, Project: "tc-macro", Slice: "1" },
});

const dbSg = new aws.ec2.SecurityGroup(`${namePrefix}-db-sg`, {
  vpcId,
  description: "TC Macro MacroDB Postgres",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      securityGroups: [ecsSg.id],
      description: "ECS to Postgres",
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: `${namePrefix}-db-sg`, Project: "tc-macro", Slice: "1" },
});

const redisSg = new aws.ec2.SecurityGroup(`${namePrefix}-redis-sg`, {
  vpcId,
  description: "TC Macro Redis",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 6379,
      toPort: 6379,
      securityGroups: [ecsSg.id],
      description: "ECS to Redis",
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: { Name: `${namePrefix}-redis-sg`, Project: "tc-macro", Slice: "1" },
});

// --- ALB (HTTP only — ACM/HTTPS when domain ready) ---
const alb = new aws.lb.LoadBalancer(`${namePrefix}-alb`, {
  name: `${namePrefix}-gw`.slice(0, 32),
  loadBalancerType: "application",
  securityGroups: [albSg.id],
  subnets: publicSubnetIds,
  tags: { Name: `${namePrefix}-alb`, Project: "tc-macro", Slice: "1" },
});

const defaultTg = new aws.lb.TargetGroup(`${namePrefix}-default-tg`, {
  name: `${namePrefix}-def`.slice(0, 32),
  port: 8080,
  protocol: "HTTP",
  targetType: "ip",
  vpcId,
  healthCheck: {
    path: "/health",
    protocol: "HTTP",
    matcher: "200-399",
    interval: 30,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  },
  tags: { Project: "tc-macro", Slice: "1" },
});

const httpListener = new aws.lb.Listener(`${namePrefix}-http`, {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "fixed-response",
      fixedResponse: {
        contentType: "text/plain",
        messageBody: "tc-macro gateway — Slice 1 (no app routes yet)",
        statusCode: "503",
      },
    },
  ],
});

// --- RDS MacroDB ---
const dbSubnetGroup = new aws.rds.SubnetGroup(`${namePrefix}-db-subnets`, {
  name: `${namePrefix}-db`,
  subnetIds: privateSubnetIds,
  tags: { Project: "tc-macro", Slice: "1" },
});

const dbPassword = new random.RandomPassword(`${namePrefix}-db-password`, {
  length: 32,
  special: false,
});

const db = new aws.rds.Instance(`${namePrefix}-macrodb`, {
  identifier: `${namePrefix}-macrodb`,
  engine: "postgres",
  engineVersion: "16",
  instanceClass: dbInstanceClass,
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  storageType: "gp3",
  dbName: "macro",
  username: "macro",
  password: dbPassword.result,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSg.id],
  publiclyAccessible: false,
  multiAz: false,
  backupRetentionPeriod: 3,
  deletionProtection: false,
  skipFinalSnapshot: true,
  tags: {
    Name: `${namePrefix}-macrodb`,
    Project: "tc-macro",
    Slice: "1",
    Role: "macrodb",
  },
});

const dbSecret = new aws.secretsmanager.Secret(`${namePrefix}-macrodb-secret`, {
  name: `/tc-macro-sync/macrodb/${environment}`,
  description: "MacroDB credentials — generated at Slice 1; rotate via AKV sync later",
  tags: { Project: "tc-macro", Slice: "1" },
});

new aws.secretsmanager.SecretVersion(`${namePrefix}-macrodb-secret-ver`, {
  secretId: dbSecret.id,
  secretString: pulumi
    .all([db.address, db.port, dbPassword.result, db.dbName])
    .apply(([host, port, password, database]) =>
      JSON.stringify({
        host,
        port,
        username: "macro",
        password,
        database,
        engine: "postgres",
      }),
    ),
});

// --- ElastiCache Redis ---
const redisSubnetGroup = new aws.elasticache.SubnetGroup(
  `${namePrefix}-redis-subnets`,
  {
    name: `${namePrefix}-redis`,
    subnetIds: privateSubnetIds,
  },
);

const redis = new aws.elasticache.Cluster(`${namePrefix}-redis`, {
  clusterId: `${namePrefix}-redis`.slice(0, 40),
  engine: "redis",
  engineVersion: "7.1",
  nodeType: redisNodeType,
  numCacheNodes: 1,
  port: 6379,
  subnetGroupName: redisSubnetGroup.name,
  securityGroupIds: [redisSg.id],
  tags: { Project: "tc-macro", Slice: "1", Role: "redis" },
});

const redisSecret = new aws.secretsmanager.Secret(`${namePrefix}-redis-secret`, {
  name: `/tc-macro-sync/redis/${environment}`,
  description: "Redis endpoint — Slice 1",
  tags: { Project: "tc-macro", Slice: "1" },
});

new aws.secretsmanager.SecretVersion(`${namePrefix}-redis-secret-ver`, {
  secretId: redisSecret.id,
  secretString: pulumi
    .all([redis.cacheNodes])
    .apply(([nodes]) =>
      JSON.stringify({
        host: nodes?.[0]?.address,
        port: nodes?.[0]?.port ?? 6379,
      }),
    ),
});

// Outputs
export const albDnsName = alb.dnsName;
export const albArn = alb.arn;
export const httpListenerArn = httpListener.arn;
export const defaultTargetGroupArn = defaultTg.arn;
export const albSecurityGroupId = albSg.id;
export const ecsSecurityGroupId = ecsSg.id;
export const dbEndpoint = db.address;
export const dbPort = db.port;
export const dbSecretArn = dbSecret.arn;
export const redisPrimaryEndpoint = redis.cacheNodes.apply(
  (n) => n?.[0]?.address ?? "",
);
export const redisSecretArn = redisSecret.arn;
export const gatewayUrl = alb.dnsName.apply((d) => `http://${d}`);
