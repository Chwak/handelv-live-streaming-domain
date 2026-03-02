#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LiveStreamingDomainStack } from "../lib/live-streaming-domain-stack";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") ?? "dev";
const regionCode = app.node.tryGetContext("regionCode") ?? "use1";

new LiveStreamingDomainStack(app, `${environment}-${regionCode}-hand-made-live-streaming-domain-stack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  environment,
  regionCode,
});
