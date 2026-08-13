import type { S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { Profile } from "./profiles";

export type AppEnv = {
  Variables: {
    profile: Profile;
    s3: S3Client;
    sqs: SQSClient;
  };
};
