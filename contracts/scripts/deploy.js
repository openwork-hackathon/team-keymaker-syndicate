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

  // Grant admin role to deployer
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    const [deployer] = await hre.ethers.getSigners();
    const registryContract = await hre.ethers.getContractAt("AgentRegistry", registry.address, deployer);
    await registryContract.grantAdminRole(deployer.address);
    console.log("Granted admin role to deployer:", deployer.address);
  }

  console.log("\nDeployment complete!");
  console.log("Don't forget to verify contracts on BaseScan.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});