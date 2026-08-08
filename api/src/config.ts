/** `ENABLE_S3=0`, `=false`, `=no` and `=off` all disable a feature; anything else enables it. */
function flag(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

const shared = process.env.AWS_ENDPOINT_URL;

export const settings = {
  awsDefaultRegion: process.env.AWS_DEFAULT_REGION,
  // Prefer the service-specific endpoint, fall back to the shared one.
  s3EndpointUrl: process.env.AWS_S3_ENDPOINT_URL || shared,
  sqsEndpointUrl: process.env.AWS_SQS_ENDPOINT_URL || shared,
  enableS3: flag(process.env.ENABLE_S3, true),
  enableSqs: flag(process.env.ENABLE_SQS, true),
};
