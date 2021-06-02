import * as core from "@actions/core";
import * as github from "@actions/github";

type DeploymentState =
  | "error"
  | "failure"
  | "inactive"
  | "in_progress"
  | "queued"
  | "pending"
  | "success";

function isProductionEnvironment(productionEnvironmentInput: string): boolean | undefined {
  if (["true", "false"].includes(productionEnvironmentInput)) {
    return productionEnvironmentInput === "true";
  }
  // Use undefined to signal, that the default behavior should be used.
  return undefined;
}

async function run() {
  try {
    const context = github.context;

    const pr_id = core.getInput("pr_id", { required: false });

    const logUrl = pr_id ? `https://github.com/${context.repo.owner}/${context.repo.repo}/pull/${pr_id}/checks` :
        `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${context.sha}/checks`;

    const token = core.getInput("token", { required: true });
    const headRef = process.env.GITHUB_HEAD_REF as string;
    const ref = core.getInput("ref", { required: false }) || headRef || context.ref;
    const url = core.getInput("target_url", { required: false }) || logUrl;
    const payload = core.getInput("payload", { required: false }) ;
    const environment =
      core.getInput("environment", { required: false }) || "production";
    const description = core.getInput("description", { required: false });
    const initialStatus =
      (core.getInput("initial_status", {
        required: false
      }) as DeploymentState) || "pending";
    const autoMergeStringInput = core.getInput("auto_merge", {
      required: false
    });
    const transientEnvironment = core.getInput("transient_environment", { required: false }) === "true";
    const productionEnvironment = isProductionEnvironment(core.getInput("production_environment", { required: false }));

    const auto_merge: boolean = autoMergeStringInput === "true";

    const client = new github.GitHub(token, { previews: ["flash", "ant-man"] });

    const deployment = await client.repos.createDeployment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: ref,
      required_contexts: [],
      environment,
      payload: payload ? JSON.parse(payload) : {},
      transient_environment: transientEnvironment,
      production_environment: productionEnvironment,
      auto_merge,
      description
    });

    await client.repos.createDeploymentStatus({
      ...context.repo,
      deployment_id: deployment.data.id,
      state: initialStatus,
      log_url: logUrl,
      environment_url: url
    });

    core.setOutput("deployment_id", deployment.data.id.toString());
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
