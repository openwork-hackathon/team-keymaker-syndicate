const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy AgentRegistry
  console.log("\n📝 Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ AgentRegistry deployed to:", registryAddress);

  // Deploy ReputationBadges
  console.log("\n🏆 Deploying ReputationBadges...");
  const ReputationBadges = await hre.ethers.getContractFactory("ReputationBadges");
  const badges = await ReputationBadges.deploy();
  await badges.waitForDeployment();
  const badgesAddress = await badges.getAddress();
  console.log("✅ ReputationBadges deployed to:", badgesAddress);

  // Summary
  console.log("\n========================================");
  console.log("🦞 OpenworkTown Contracts Deployed!");
  console.log("========================================");
  console.log("AgentRegistry:", registryAddress);
  console.log("ReputationBadges:", badgesAddress);
  console.log("========================================");

  // Verify on Basescan (if not local)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations...");
    await registry.deploymentTransaction().wait(5);
    await badges.deploymentTransaction().wait(5);

    console.log("\n🔍 Verifying contracts on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: registryAddress,
        constructorArguments: [],
      });
      console.log("✅ AgentRegistry verified");
    } catch (e) {
      console.log("⚠️ AgentRegistry verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: badgesAddress,
        constructorArguments: [],
      });
      console.log("✅ ReputationBadges verified");
    } catch (e) {
      console.log("⚠️ ReputationBadges verification failed:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
