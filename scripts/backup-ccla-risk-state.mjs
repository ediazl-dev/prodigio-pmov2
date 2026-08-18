import { createConnection } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectId = 600001;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está configurada.');

const connection = await createConnection(connectionString);
const readRows = async (table, where = 'projectId = ?', parameters = [projectId]) => {
  const [rows] = await connection.execute(`SELECT * FROM \`${table}\` WHERE ${where}`, parameters);
  return rows;
};

try {
  const snapshot = {
    createdAt: new Date().toISOString(),
    purpose: 'Respaldo previo a corrección de generación de riesgos IA',
    projectId,
    data: {
      project: await readRows('projects', 'id = ?', [projectId]),
      projectStages: await readRows('project_stages'),
      sowDocuments: await readRows('sow_documents'),
      stageApprovals: await readRows('stage_approvals'),
      risks: await readRows('risks'),
      riskVersions: await readRows('risk_versions'),
      stageClosures: await readRows('stage_closures'),
    },
  };

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const dataSha256 = createHash('sha256').update(serialized).digest('hex');
  const backup = { ...snapshot, dataSha256 };
  const outputDir = '/home/ubuntu/pmo-risk-backups';
  const outputPath = path.join(outputDir, `ccla-risk-state-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const backupSerialized = `${JSON.stringify(backup, null, 2)}\n`;
  const fileSha256 = createHash('sha256').update(backupSerialized).digest('hex');

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, backupSerialized, 'utf8');
  await writeFile(`${outputPath}.sha256`, `${fileSha256}  ${path.basename(outputPath)}\n`, 'utf8');
  console.log(JSON.stringify({
    outputPath,
    dataSha256,
    fileSha256,
    counts: Object.fromEntries(Object.entries(snapshot.data).map(([key, rows]) => [key, rows.length])),
  }));
} finally {
  await connection.end();
}

process.exit(0);
