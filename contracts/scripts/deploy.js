const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts to", hre.network.name);

  // Deploy AgentRegistry
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  console.log("AgentRegistry deployed to:", await registry.getAddress());

  // Deploy ReputationBadges
  const ReputationBadges = await hre.ethers.getContractFactory("ReputationBadges");
  const badges = await ReputationBadges.deploy();
  await badges.waitForDeployment();
  console.log("ReputationBadges deployed to:", await badges.getAddress());

  console.log("\nDeployment complete!");
  console.log("Don't forget to verify contracts on BaseScan.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
