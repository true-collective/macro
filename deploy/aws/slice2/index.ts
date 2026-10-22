/**
 * Slice 2 — shared AWS platform for G1 (no app images, no FA, no MSK/OpenSearch).
 * Creates: KMS, S3 buckets, SQS(+DLQ), DynamoDB, ECR repos, SM inventory.
 */
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();
const environment = cfg.get("environment") ?? "dev";
const namePrefix = `tc-macro-${environment}`;
const accountId = aws.getCallerIdentityOutput().accountId;
const region = aws.config.region ?? "us-east-1";

const commonTags = {
  Project: "tc-macro",
  Slice: "2",
  Environment: environment,
};

// --- KMS ---
const kmsKey = new aws.kms.Key(`${namePrefix}-kms`, {
  description: "TC Macro staging crypto (tokens, buckets)",
  deletionWindowInDays: 7,
  enableKeyRotation: true,
  tags: { ...commonTags, Name: `${namePrefix}-kms` },
});

const kmsAlias = new aws.kms.Alias(`${namePrefix}-kms-alias`, {
  name: `alias/${namePrefix}`,
  targetKeyId: kmsKey.id,
});

// --- S3 buckets (staging; force destroy OK) ---
const documentsBucketName = pulumi.interpolate`tc-macro-documents-${environment}-${accountId}`;
const staticBucketName = pulumi.interpolate`tc-macro-static-${environment}-${accountId}`;
const uploadsBucketName = pulumi.interpolate`tc-macro-uploads-${environment}-${accountId}`;
const documents = new aws.s3.BucketV2(`${namePrefix}-documents`, {
  bucket: documentsBucketName,
  forceDestroy: true,
  tags: { ...commonTags, Name: "documents", Role: "documents" },
});
new aws.s3.BucketServerSideEncryptionConfigurationV2(
  `${namePrefix}-documents-sse`,
  {
    bucket: documents.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "aws:kms",
          kmsMasterKeyId: kmsKey.arn,
        },
        bucketKeyEnabled: true,
      },
    ],
  },
);
new aws.s3.BucketPublicAccessBlock(`${namePrefix}-documents-pab`, {
  bucket: documents.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

const staticFiles = new aws.s3.BucketV2(`${namePrefix}-static`, {
  bucket: staticBucketName,
  forceDestroy: true,
  tags: { ...commonTags, Name: "static", Role: "static" },
});
new aws.s3.BucketServerSideEncryptionConfigurationV2(
  `${namePrefix}-static-sse`,
  {
    bucket: staticFiles.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "aws:kms",
          kmsMasterKeyId: kmsKey.arn,
        },
        bucketKeyEnabled: true,
      },
    ],
  },
);
new aws.s3.BucketPublicAccessBlock(`${namePrefix}-static-pab`, {
  bucket: staticFiles.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

const uploads = new aws.s3.BucketV2(`${namePrefix}-uploads`, {
  bucket: uploadsBucketName,
  forceDestroy: true,
  tags: { ...commonTags, Name: "uploads", Role: "uploads" },
});
new aws.s3.BucketServerSideEncryptionConfigurationV2(
  `${namePrefix}-uploads-sse`,
  {
    bucket: uploads.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "aws:kms",
          kmsMasterKeyId: kmsKey.arn,
        },
        bucketKeyEnabled: true,
      },
    ],
  },
);
new aws.s3.BucketPublicAccessBlock(`${namePrefix}-uploads-pab`, {
  bucket: uploads.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// --- SQS + DLQ ---
function queueWithDlq(logical: string) {
  const dlq = new aws.sqs.Queue(`${namePrefix}-${logical}-dlq`, {
    name: `${namePrefix}-${logical}-dlq`,
    messageRetentionSeconds: 1209600,
    tags: { ...commonTags, Role: `${logical}-dlq` },
  });
  const q = new aws.sqs.Queue(`${namePrefix}-${logical}`, {
    name: `${namePrefix}-${logical}`,
    visibilityTimeoutSeconds: 60,
    redrivePolicy: dlq.arn.apply((arn) =>
      JSON.stringify({ deadLetterTargetArn: arn, maxReceiveCount: 5 }),
    ),
    tags: { ...commonTags, Role: logical },
  });
  return { queue: q, dlq };
}

const searchUpload = queueWithDlq("search-upload");
const documentUpload = queueWithDlq("document-upload");

// --- DynamoDB ---
const connectionGatewayTable = new aws.dynamodb.Table(
  `${namePrefix}-connection-gateway`,
  {
    name: `${namePrefix}-connection-gateway`,
    billingMode: "PAY_PER_REQUEST",
    hashKey: "pk",
    rangeKey: "sk",
    attributes: [
      { name: "pk", type: "S" },
      { name: "sk", type: "S" },
    ],
    tags: { ...commonTags, Role: "connection-gateway" },
  },
);

const staticFileTable = new aws.dynamodb.Table(`${namePrefix}-static-file`, {
  name: `${namePrefix}-static-file`,
  billingMode: "PAY_PER_REQUEST",
  hashKey: "pk",
  rangeKey: "sk",
  attributes: [
    { name: "pk", type: "S" },
    { name: "sk", type: "S" },
  ],
  tags: { ...commonTags, Role: "static-file" },
});

// --- ECR (empty repos for G1 image push later) ---
const ecrServiceNames = [
  "authentication-service",
  "document-storage-service",
  "lexical-service",
  "connection-gateway",
  "search-processing-service",
  "agent-harness-service",
  "notification-service",
  "static-file-service",
  "preview-gateway",
  "fusionauth",
  "web-app",
] as const;

const ecrRepos = ecrServiceNames.map(
  (svc) =>
    new aws.ecr.Repository(`${namePrefix}-ecr-${svc}`, {
      name: `tc-macro/${svc}`,
      imageTagMutability: "MUTABLE",
      forceDelete: true,
      imageScanningConfiguration: { scanOnPush: true },
      tags: { ...commonTags, Service: svc },
    }),
);

// --- SM inventory (ARNs/names only — no DB passwords) ---
const platformSecret = new aws.secretsmanager.Secret(
  `${namePrefix}-platform-secret`,
  {
    name: `/tc-macro-sync/platform/${environment}`,
    description:
      "TC Macro Slice 2 platform inventory (ARNs). App secrets still from AKV sync.",
    tags: commonTags,
  },
);

new aws.secretsmanager.SecretVersion(`${namePrefix}-platform-secret-ver`, {
  secretId: platformSecret.id,
  secretString: pulumi
    .all([
      kmsKey.arn,
      documents.bucket,
      staticFiles.bucket,
      uploads.bucket,
      searchUpload.queue.url,
      documentUpload.queue.url,
      connectionGatewayTable.name,
      staticFileTable.name,
      ...ecrRepos.map((r) => r.repositoryUrl),
    ])
    .apply(
      ([
        kmsArn,
        docs,
        stat,
        up,
        searchUrl,
        docUrl,
        cgTable,
        sfTable,
        ...ecrUrls
      ]) =>
        JSON.stringify(
          {
            environment,
            region,
            kmsKeyArn: kmsArn,
            buckets: {
              documents: docs,
              static: stat,
              uploads: up,
            },
            queues: {
              searchUpload: searchUrl,
              documentUpload: docUrl,
            },
            dynamodb: {
              connectionGateway: cgTable,
              staticFile: sfTable,
            },
            ecr: Object.fromEntries(
              ecrServiceNames.map((name, i) => [name, ecrUrls[i]]),
            ),
          },
          null,
          2,
        ),
    ),
});

export const kmsKeyArn = kmsKey.arn;
export const kmsAliasName = kmsAlias.name;
export const documentsBucketId = documents.bucket;
export const staticBucketId = staticFiles.bucket;
export const uploadsBucketId = uploads.bucket;
export const searchUploadQueueUrl = searchUpload.queue.url;
export const documentUploadQueueUrl = documentUpload.queue.url;
export const connectionGatewayTableName = connectionGatewayTable.name;
export const staticFileTableName = staticFileTable.name;
export const ecrRepositoryUrls = pulumi
  .all(ecrRepos.map((r) => r.repositoryUrl))
  .apply((urls) =>
    Object.fromEntries(ecrServiceNames.map((name, i) => [name, urls[i]])),
  );
export const platformSecretArn = platformSecret.arn;
