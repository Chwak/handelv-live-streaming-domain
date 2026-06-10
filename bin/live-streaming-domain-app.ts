#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LiveStreamingDomainStack } from "../lib/live-streaming-domain-stack";
import { LiveStreamingDomainPipelineStack } from "../lib/live-streaming-domain-pipeline-stack";
import { GITHUB_CONNECTION_ARN, initCdkAppDeploy } from "../lib/utils/deployment-env";

const app = new cdk.App();
const { environment, regionCode, account, region } = initCdkAppDeploy(app);

new LiveStreamingDomainStack(app, `${environment}-${regionCode}-hand-made-live-streaming-domain-stack`, {
  env: { account, region },
  environment,
  regionCode,
});

new LiveStreamingDomainPipelineStack(app, "LiveStreamingDomainPipelineStack", {
  env: { account, region },
  domain: "live-streaming-domain",
  githubConnectionArn: GITHUB_CONNECTION_ARN,
  description: "live-streaming-domain CDK (account 741429964649 only)",
});

app.synth();
