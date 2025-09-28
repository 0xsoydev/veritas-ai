const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying AI Agent NFT Contract...");

  // Get the contract factory
  const AIAgentNFT = await ethers.getContractFactory("AIAgentNFT");

  // Deploy the contract
  const aiAgentNFT = await AIAgentNFT.deploy();

  // Wait for deployment to complete
  await aiAgentNFT.waitForDeployment();

  const contractAddress = await aiAgentNFT.getAddress();

  console.log("✅ AI Agent NFT Contract deployed to:", contractAddress);
  console.log("📋 Contract details:");
  console.log("  - Name: AIAgentNFT");
  console.log("  - Symbol: AIAGENT");
  console.log("  - Address:", contractAddress);
  console.log("  - Owner:", await aiAgentNFT.owner());

  // Get network info
  const network = await ethers.provider.getNetwork();
  
  // Save deployment info
  const deploymentInfo = {
    contractName: "AIAgentNFT",
    address: contractAddress,
    network: network.name || "polygonAmoy",
    chainId: network.chainId.toString(),
    deployedAt: new Date().toISOString(),
    owner: await aiAgentNFT.owner(),
  };

  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 Deployment completed successfully!");
  console.log("💡 Next steps:");
  console.log("  1. Update your frontend with the contract address");
  console.log("  2. Configure the contract in your environment variables");
  console.log("  3. Start minting AI Agent NFTs!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });