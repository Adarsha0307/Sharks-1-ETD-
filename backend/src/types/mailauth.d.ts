declare module "mailauth/lib/dkim/verify.js" {
  export function dkimVerify(
    message: Buffer,
    options: { resolver: (name: string, type: string) => Promise<unknown>; minBitLength: number },
  ): Promise<{
    results?: Array<{
      signingDomain?: string;
      status?: { result?: string; comment?: string };
    }>;
  }>;
}

declare module "mailauth/lib/spf/index.js" {
  export function spf(options: {
    sender: string;
    ip: string;
    helo: string;
    mta: string;
    resolver: (name: string, type: string) => Promise<unknown>;
  }): Promise<{ status?: { result?: string; comment?: string } }>;
}
