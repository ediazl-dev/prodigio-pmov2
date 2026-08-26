import { syncExecutiveMilestonesFromJira } from "../server/jiraMilestoneSync";

async function main() {
  const result = await syncExecutiveMilestonesFromJira();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
