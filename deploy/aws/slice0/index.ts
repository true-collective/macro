import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();
const environment = cfg.get("environment") ?? "dev";
const vpcCidr = cfg.get("vpcCidr") ?? "10.80.0.0/16";
const namePrefix = `tc-macro-${environment}`;

const azs = aws.getAvailabilityZonesOutput({
  state: "available",
  filters: [{ name: "opt-in-status", values: ["opt-in-not-required"] }],
}).names.apply((names) => names.slice(0, 3));

const vpc = new aws.ec2.Vpc(namePrefix, {
  cidrBlock: vpcCidr,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: namePrefix,
    Project: "tc-macro",
    Slice: "0",
    Environment: environment,
  },
});

const igw = new aws.ec2.InternetGateway(`${namePrefix}-igw`, {
  vpcId: vpc.id,
  tags: { Name: `${namePrefix}-igw`, Project: "tc-macro", Slice: "0" },
});

// Public: 10.80.0.0/20, 10.80.16.0/20, 10.80.32.0/20
// Private: 10.80.64.0/20, 10.80.80.0/20, 10.80.96.0/20
const publicCidrs = ["10.80.0.0/20", "10.80.16.0/20", "10.80.32.0/20"];
const privateCidrs = ["10.80.64.0/20", "10.80.80.0/20", "10.80.96.0/20"];

const publicSubnets = publicCidrs.map(
  (cidr, i) =>
    new aws.ec2.Subnet(`${namePrefix}-public-${i}`, {
      vpcId: vpc.id,
      cidrBlock: cidr,
      availabilityZone: azs.apply((a) => a[i]),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${namePrefix}-public-${i}`,
        Project: "tc-macro",
        Slice: "0",
        Tier: "public",
      },
    }),
);

const privateSubnets = privateCidrs.map(
  (cidr, i) =>
    new aws.ec2.Subnet(`${namePrefix}-private-${i}`, {
      vpcId: vpc.id,
      cidrBlock: cidr,
      availabilityZone: azs.apply((a) => a[i]),
      tags: {
        Name: `${namePrefix}-private-${i}`,
        Project: "tc-macro",
        Slice: "0",
        Tier: "private",
      },
    }),
);

const eip = new aws.ec2.Eip(`${namePrefix}-nat-eip`, {
  domain: "vpc",
  tags: { Name: `${namePrefix}-nat-eip`, Project: "tc-macro", Slice: "0" },
});

const nat = new aws.ec2.NatGateway(`${namePrefix}-nat`, {
  allocationId: eip.id,
  subnetId: publicSubnets[0].id,
  tags: { Name: `${namePrefix}-nat`, Project: "tc-macro", Slice: "0" },
}, { dependsOn: [igw] });

const publicRt = new aws.ec2.RouteTable(`${namePrefix}-public-rt`, {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: igw.id }],
  tags: { Name: `${namePrefix}-public-rt`, Project: "tc-macro", Slice: "0" },
});

const privateRt = new aws.ec2.RouteTable(`${namePrefix}-private-rt`, {
  vpcId: vpc.id,
  routes: [{ cidrBlock: "0.0.0.0/0", natGatewayId: nat.id }],
  tags: { Name: `${namePrefix}-private-rt`, Project: "tc-macro", Slice: "0" },
});

publicSubnets.forEach((subnet, i) => {
  new aws.ec2.RouteTableAssociation(`${namePrefix}-public-rta-${i}`, {
    subnetId: subnet.id,
    routeTableId: publicRt.id,
  });
});

privateSubnets.forEach((subnet, i) => {
  new aws.ec2.RouteTableAssociation(`${namePrefix}-private-rta-${i}`, {
    subnetId: subnet.id,
    routeTableId: privateRt.id,
  });
});

// Secrets bridge proof — placeholder JSON; real values come from AKV later (manual sync OK for Slice 0)
const bootstrapSecret = new aws.secretsmanager.Secret(`${namePrefix}-bootstrap`, {
  name: "/tc-macro-sync/_bootstrap/dev",
  description:
    "TC Macro Slice 0 AKV→SM bridge proof. Replace payload from Azure Key Vault tc-macro/* — do not put production secrets in git.",
  tags: { Project: "tc-macro", Slice: "0", Environment: environment },
});

new aws.secretsmanager.SecretVersion(`${namePrefix}-bootstrap-ver`, {
  secretId: bootstrapSecret.id,
  secretString: JSON.stringify({
    source: "tc-macro-slice0-bootstrap",
    note: "Placeholder — sync from Azure Key Vault tc-macro/* before app deploy",
    environment,
    region: "us-east-1",
  }),
});

const cluster = new aws.ecs.Cluster(`${namePrefix}-cluster`, {
  name: namePrefix,
  settings: [{ name: "containerInsights", value: "disabled" }],
  tags: { Project: "tc-macro", Slice: "0", Environment: environment },
});

// Outputs — same shape as get_coparse_api_vpc() for TC adapter
export const vpcId = vpc.id;
export const publicSubnetIds = pulumi.output(publicSubnets.map((s) => s.id));
export const privateSubnetIds = pulumi.output(privateSubnets.map((s) => s.id));
export const natGatewayId = nat.id;
export const ecsClusterName = cluster.name;
export const ecsClusterArn = cluster.arn;
export const bootstrapSecretArn = bootstrapSecret.arn;
export const bootstrapSecretName = bootstrapSecret.name;
export const vpcCidrBlock = vpc.cidrBlock;
export const adapterEnvHint = pulumi
  .all([
    vpc.id,
    privateSubnets[0].id,
    privateSubnets[1].id,
    privateSubnets[2].id,
    publicSubnets[0].id,
    publicSubnets[1].id,
    publicSubnets[2].id,
  ])
  .apply(([vid, p0, p1, p2, u0, u1, u2]) => ({
    TC_MACRO_VPC_ID: vid,
    TC_MACRO_PRIVATE_SUBNET_IDS: [p0, p1, p2].join(","),
    TC_MACRO_PUBLIC_SUBNET_IDS: [u0, u1, u2].join(","),
  }));
