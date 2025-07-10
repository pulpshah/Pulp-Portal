import { execSync } from "child_process";
import os from "os";

const domain = "pulpinternet";
const domainOwner = "080063284424";
const region = "us-east-1";

try {
  const token = execSync(
    `aws codeartifact get-authorization-token --domain ${domain} --domain-owner ${domainOwner} --region ${region} --query authorizationToken --output text`,
    { encoding: "utf-8" },
  ).trim();

  const isWindows = os.platform() === "win32";

  if (isWindows) {
    execSync(`$env:CODEARTIFACT_AUTH_TOKEN="${token}"`, {
      shell: "powershell.exe",
      stdio: "inherit",
    });
  } else {
    execSync(`export CODEARTIFACT_AUTH_TOKEN="${token}"`, {
      shell: "/bin/bash",
      stdio: "inherit",
    });
  }

  console.log("✅ CodeArtifact token set successfully!");
} catch (err) {
  console.error("❌ Failed to get CodeArtifact token:", err.message);
  process.exit(1);
}
