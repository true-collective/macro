/**
 * TC Macro VPC adapter — replaces infra/packages/vpc hardcodes for True Collective.
 *
 * Source of truth: Slice 0 stack outputs (or env overrides).
 * Never embed Macro-inc vpc-0c7510191d4fc9263 / subnet IDs here.
 */

export type TcMacroVpc = {
  vpcId: string;
  privateSubnetIds: string[];
  publicSubnetIds: string[];
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Export Slice 0 outputs (see deploy/aws/README.md) or set TC_MACRO_* env vars.`,
    );
  }
  return v;
}

function csv(name: string): string[] {
  return requireEnv(name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Resolve TC Macro VPC the same shape as get_coparse_api_vpc(). */
export function get_tc_macro_vpc(): TcMacroVpc {
  return {
    vpcId: requireEnv("TC_MACRO_VPC_ID"),
    privateSubnetIds: csv("TC_MACRO_PRIVATE_SUBNET_IDS"),
    publicSubnetIds: csv("TC_MACRO_PUBLIC_SUBNET_IDS"),
  };
}
